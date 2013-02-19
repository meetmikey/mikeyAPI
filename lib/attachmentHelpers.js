var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , s3Utils = require(serverCommon + '/lib/s3Utils')
  , constants = require('../constants')


var attachmentHelpers = this;

exports.getAttachmentsByHash = function (attachmentHashes, userId, scores, callback) {

  console.log (scores)
  var hashes = attachmentHashes.map(function (pair) { return pair.hash})
  var fileSizes = attachmentHashes.map(function (pair) { return pair.fileSize})

  AttachmentModel.find({userId:userId})
    .where ('hash').in(hashes)
    .where ('fileSize').in(fileSizes)
    .select (constants.DEFAULT_FIELDS_ATTACHMENT)
    .exec (function (err, foundAttachments) {
      if ( err ) {
        winston.doMongoError(err, res);
      } else {
        attachmentHelpers.addSignedURLs(foundAttachments, userId)
        attachmentHelpers.sortByScore(foundAttachments, scores) 
        callback(null, foundAttachments);
      }
    })
}

exports.addSignedURLs = function(attachments, userId) {
  attachments.forEach (function (attachment) {
    if ( mailUtils.isImage(attachment) && ( ! attachment.image ) ) {
      var attachmentId = attachment._id;
      var s3Path = s3Utils.getAttachmentS3Path(attachment);
      var signedURL = s3Utils.signedURL(s3Path, constants.URL_EXPIRE_TIME_MINUTES);
      attachment.signedURL = 'https://' + conf.domain + '/attachmentURL/' + attachmentId;
      //winston.info('set signedURL: ' + signedURL + ' on attachment: ', attachment);
      attachment.image = signedURL;
    }
  })
}

exports.sortByScore = function (attachments, scores) {
  attachments.sort (function (a, b) {
    console.log (scores[attachmentHelpers.getId (b)])
    return scores[attachmentHelpers.getId (b)] - scores[attachmentHelpers.getId (a)]
  })
}

exports.getId = function (attachment) {
  console.log (attachment.hash + '_' + attachment.fileSize)
  return attachment.hash + '_' + attachment.fileSize
}
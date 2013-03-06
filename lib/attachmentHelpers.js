var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , s3Utils = require(serverCommon + '/lib/s3Utils')
  , constants = require('../constants')
  , activeConnectionHelpers = require ('../lib/activeConnectionHelpers')


var attachmentHelpers = this;

exports.getAttachmentsByHash = function (attachmentHashes, userId, scores, callback) {

  var hashes = attachmentHashes.map(function (pair) { return pair.hash})
  var fileSizes = attachmentHashes.map(function (pair) { return pair.fileSize})

  AttachmentModel.find({userId:userId})
    .where ('hash').in(hashes)
    .where ('fileSize').in(fileSizes)
    .select (constants.DEFAULT_FIELDS_ATTACHMENT)
    .exec (function (err, foundAttachments) {
      if ( err ) {
        winston.doMongoError(err, res);
        callback (err);
      } else {
        attachmentHelpers.addSignedURLs(foundAttachments, userId)
        attachmentHelpers.sortByScore(foundAttachments, scores) 
        callback(null, foundAttachments);
      }
    })
}

exports.addSignedURLs = function(attachments, userId) {
  attachments.forEach (function (attachment) {
    var imageS3Path = '';
    if ( attachment.image ) {
      imageS3Path = attachment.image;
    } else if ( mailUtils.isAttachmentImage(attachment) ) {
      imageS3Path = s3Utils.getAttachmentS3Path(attachment);
    }

    if ( imageS3Path ) {
      var signedURL = s3Utils.signedURL(imageS3Path, constants.URL_EXPIRE_TIME_MINUTES);
      //winston.info('set signedURL: ' + signedURL + ' on attachment: ', attachment);
      attachment.image = signedURL;
    }
  })
}

exports.sortByScore = function (attachments, scores) {
  attachments.sort (function (a, b) {
    //console.log (scores[attachmentHelpers.getId (b)])
    return scores[attachmentHelpers.getId (b)] - scores[attachmentHelpers.getId (a)]
  })
}

exports.getId = function (attachment) {
  //console.log (attachment.hash + '_' + attachment.fileSize)
  return attachment.hash + '_' + attachment.fileSize
}

exports.getFiles = function(req, res, getImagesInput) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.warn('attachmentHelpers: getFiles: missing userId');
    res.send(400, 'bad request');
  }

  var userId = req.user._id;
  var before = req.query.before;
  var after = req.query.after;
  var limit = req.query.limit;

  // update last access time
  activeConnectionHelpers.updateLastAccessTime (req.user);
  
  if (!limit) {
    limit = 50
  }

  if (constants.USE_SPOOFED_USER) {
    userId = constants.SPOOFED_USER_ID;
  }

  var getImages = false;
  if ( getImagesInput ) {
    getImages = true;
  }

  var query = AttachmentModel.find({userId:userId, 'isPromoted':true, 'isImage': getImages});
  
  if (before) {
    query.where ('sentDate').lt (before)
  }

  if (after) {
    query.where ('sentDate').gt (after)    
  }

  query.sort ('-sentDate')
    .limit (limit)
    .select(constants.DEFAULT_FIELDS_ATTACHMENT)
    .exec(function(err, foundAttachments) {
      if ( err ) {
        winston.doMongoError(err, res);
      } else {
        attachmentHelpers.addSignedURLs(foundAttachments, userId);
        res.send( foundAttachments );
      }
    });
}
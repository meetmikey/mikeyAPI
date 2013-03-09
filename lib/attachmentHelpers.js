var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , cloudStorageUtils = require(serverCommon + '/lib/cloudStorageUtils')
  , constants = require('../constants');

var attachmentHelpers = this;

exports.getAttachmentsByHash = function (attachmentHashes, userId, scores, callback) {

  var hashes = attachmentHashes.map(function (pair) { return pair.hash})

  AttachmentModel.find({userId:userId})
    .where ('hash').in(hashes)
    .select (constants.DEFAULT_FIELDS_ATTACHMENT)
    .exec (function (err, foundAttachments) {
      if ( err ) {
        winston.doMongoError(err, res);
        callback (err);
      } else {
        attachmentHelpers.addSignedURLs(foundAttachments, userId);
        attachmentHelpers.sortByScore(foundAttachments, scores);
        var attachmentsAndImages = attachmentHelpers.splitOutImages( foundAttachments );
        callback(null, attachmentsAndImages);
      }
    })
}

exports.splitOutImages = function( attachments ) {
  var result = {
      attachments: []
    , images: []
  }
  if ( attachments && ( attachments.length > 0 ) ) {
    for ( var i=0; i<attachments.length; i++ ) {
      var attachment = attachments[i];
      if ( attachment.isImage ) {
        result.images.push(attachment);
      } else {
        result.attachments.push(attachment);
      }
    }
  }
  return result;
}

exports.addSignedURLs = function(attachments, userId) {
  attachments.forEach (function (attachment) {
    var imageCloudPath = '';
    if ( attachment.image ) {
      imageCloudPath = attachment.image;
    } else if ( mailUtils.isAttachmentImage(attachment) ) {
      imageCloudPath = cloudStorageUtils.getAttachmentPath(attachment);
    }

    if ( imageCloudPath ) {
      var signedURL = cloudStorageUtils.signedURL(imageCloudPath, constants.URL_EXPIRE_TIME_MINUTES, attachment);
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
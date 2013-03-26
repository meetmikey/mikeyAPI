var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , mongoUtils = require(serverCommon + '/lib/mongoUtils')
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , cloudStorageUtils = require(serverCommon + '/lib/cloudStorageUtils')
  , mikeyAPIConstants = require('../constants');

var attachmentHelpers = this;

exports.getAttachmentsByHash = function (attachmentHashes, userId, scores, callback) {
  var hashes = attachmentHashes.map(function (pair) { return pair.hash})

  AttachmentModel.find({userId:userId, shardKey: mongoUtils.getShardKeyHash( userId )})
    .where ('hash').in(hashes)
    .select (mikeyAPIConstants.DEFAULT_FIELDS_ATTACHMENT)
    .exec (function (err, foundAttachments) {
      if ( err ) {
        winston.doMongoError(err);
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
  //dedupe images
  result.images = attachmentHelpers.dedupeFiles( result.images );
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
      var signedURL = cloudStorageUtils.signedURL(imageCloudPath, mikeyAPIConstants.URL_EXPIRE_TIME_MINUTES, attachment);
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

exports.dedupeFiles = function(filesInput) {
  var files = [];
  var fileKeys = [];
  if ( filesInput && filesInput.length ) {
    for ( var i=0; i<filesInput.length; i++ ) {
      var file = filesInput[i];
      var fileKey = cloudStorageUtils.getAttachmentKey( file );
      if ( fileKeys.indexOf( fileKey ) === -1 ) {
        fileKeys.push( fileKey );
        files.push( file );
      }
    }
  }
  return files;
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

  if (mikeyAPIConstants.USE_SPOOFED_USER) {
    userId = mikeyAPIConstants.SPOOFED_USER_ID;
  }

  var getImages = false;
  if ( getImagesInput ) {
    getImages = true;
  }

  if ( ! limit ) {
    if ( getImages ) {
      limit = mikeyAPIConstants.DEFAULT_IMAGE_RESOURCE_LIMIT;
    } else {
      limit = mikeyAPIConstants.DEFAULT_RESOURCE_LIMIT;
    }
  }

  if ( getImages ) { //Fudge it a bit to adjust for de-dupe.  Won't be perfect.
    limit = limit * mikeyAPIConstants.IMAGE_DEDUPE_ADJUSTMENT_FACTOR;
  }

  var filter = {
      userId: userId
    , shardKey: mongoUtils.getShardKeyHash( userId )
    , 'isPromoted': true
  };
  if ( getImages ) {
    filter['isImage'] = true;
  } else {
    filter['isImage'] = false;
  }

  var query = AttachmentModel.find( filter );
  
  if (before) {
    query.where ('sentDate').lt (before)
  }

  if (after) {
    query.where ('sentDate').gt (after)    
  }

  query.sort ('-sentDate')
    .limit (limit)
    .select(mikeyAPIConstants.DEFAULT_FIELDS_ATTACHMENT)
    .exec(function(err, foundAttachments) {
      if ( err ) {
        winston.doMongoError(err, res);
      } else {
        var files;
        if ( getImages ) {
          files = attachmentHelpers.dedupeFiles( foundAttachments );
        } else {
          files = foundAttachments;
        }
        attachmentHelpers.addSignedURLs(files, userId);
        res.send( files );
      }
    });
}
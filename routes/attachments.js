var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , s3Utils = require(serverCommon + '/lib/s3Utils')

var routeAttachments = this;

exports.URL_EXPIRE_TIME_MINUTES = 30;

exports.getAttachments = function(req, res) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.warn('routeAttachments: getAttachments: missing userId');
    res.send(400, 'missing userId');
  }
  var userId = req.user._id;
  
  var fields = 'filename contentType size sentDate sender recipients image';

  AttachmentModel.find({userId:userId}, fields, function(err, foundAttachments) {
    if ( err ) {
      winston.doMongoError(err, res);
    } else {
      winston.info('got Attachments');
      routeAttachments.addSignedURLs(foundAttachments, function(err) {
       if ( err ) {
          winston.handleError(err, res);
        } else {
          winston.info('foundAttachments: ', foundAttachments);
          res.send( foundAttachments );
        }
      });
    }
  });
}

exports.addSignedURLs = function(attachments, callback) {
  if ( attachments && attachments.length ) {
    async.forEach(attachments,
      
      function(attachment, forEachCallback) {
        if ( mailUtils.isImage(attachment) && ( ! attachment.image ) ) {
          var attachmentId = attachment._id;
          var s3Path = mailUtils.getAttachmentS3Path(attachmentId);
          var signedURL = s3Utils.signedURL(s3Path, routeAttachments.URL_EXPIRE_TIME_MINUTES);
          attachment.signedURL = 'https://' + conf.domain + '/attachmentURL/' + attachmentId;
          //winston.info('set signedURL: ' + signedURL + ' on attachment: ', attachment);
          attachment.image = signedURL;
        }
        forEachCallback();        
      },
      function(err) {
        callback(err);
      }
    );
  }
  else {
    callback(null)
  }
}

exports.goToAttachmentSignedURL = function(req, res) {
  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.warn('routeAttachments: getAttachments: missing userId');
    res.send(400, 'missing userId');
  } else if ( ( ! req ) || ( ! req.params ) || ( ! req.params.attachmentId ) ) {
    res.send(400, 'missing attachmentId');
  } else {
    var userId = req.user._id;
    var attachmentId = req.attachmentId;

    //Make sure the attachment belongs to this user...
    AttachmentModel.findOne({_id:attachmentId, userId:userId}, function(err, foundAttachment) {
      if ( err ) {
        winston.doMongoError(err, res);
      } else if ( ! foundAttachment ) {
        res.send(400, 'attachment not found');
      } else {
        var s3Path = mailUtils.getAttachmentS3Path(attachmentId);
        s3Utils.signedURL(path, routeAttachments.URL_EXPIRE_TIME_MINUTES);
        res.redirect(signedURL);
      }
    });
  }
}
var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , s3Utils = require(serverCommon + '/lib/s3Utils')
  , constants = require('../constants')
  , attachmentHelpers = require ('../lib/attachmentHelpers')

var routeAttachments = this;


exports.getAttachments = function(req, res) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.warn('routeAttachments: getAttachments: missing userId');
    res.send(400, 'missing userId');
  }
  var userId = req.user._id;
  if (constants.USE_SPOOFED_USER) {
    userId = constants.SPOOFED_USER_ID;
  }

  AttachmentModel.find({userId:userId})
    .sort ('-sentDate')
    .select(constants.DEFAULT_FIELDS_ATTACHMENT)
    .exec(function(err, foundAttachments) {
      if ( err ) {
        winston.doMongoError(err, res);
      } else {
        attachmentHelpers.addSignedURLs(foundAttachments, userId)
        res.send( foundAttachments );
      }
    });
}

exports.goToAttachmentSignedURL = function(req, res) {
  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.warn('routeAttachments: getAttachments: missing userId');
    res.send(400, 'missing userId');
  } else if ( ( ! req ) || ( ! req.params ) || ( ! req.params.attachmentId ) ) {
    res.send(400, 'missing attachmentId');
  } else {
    var userId = req.user._id;
    if (constants.USE_SPOOFED_USER) {
      userId = constants.SPOOFED_USER_ID;
    }
    var attachmentId = req.params.attachmentId;

    //Make sure the attachment belongs to this user...
    AttachmentModel.findOne({_id:attachmentId, userId:userId}, function(err, foundAttachment) {
      if ( err ) {
        winston.doMongoError(err, res);

      } else if ( ! foundAttachment ) {
        res.send(400, 'attachment not found');

      } else {
        var s3Path = s3Utils.getAttachmentS3Path(foundAttachment);
        var signedURL = s3Utils.signedURL(s3Path, routeAttachments.URL_EXPIRE_TIME_MINUTES);
        res.redirect(signedURL);
      }
    });
  }
}

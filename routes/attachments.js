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
  , activeConnectionHelpers = require ('../lib/activeConnectionHelpers')

var routeAttachments = this;


exports.getAttachments = function(req, res) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.warn('routeAttachments: getAttachments: missing userId');
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

  var query = AttachmentModel.find({userId:userId})
  
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

exports.deleteAttachment = function (req, res) {

  var userId = req.user._id;
  var attachmentId = req.params.attachmentId;

  AttachmentModel.update ({userId : userId, _id : attachmentId}, 
    {$set : {isDeleted : true}}, 
    function (err, num) {
      if (err) {
        winston.doMongoError (err, res)
      }
      else {
        console.log ('num affected', num)
        res.send (200)
      }
    });

}

exports.deleteAttachmentBulk = function (req, res) {

  var userId = req.user._id;
  var attachmentIds = req.body.attachmentIds;

  if (!attachmentIds) {
    res.send ('bad request: must specify attachmentIds', 400);
    return;
  }

  AttachmentModel.update ({userId : userId, _id : {$in : attachmentIds}}, 
    {$set : {isDeleted : true}},
    {multi : true},
    function (err, num) {
      if (err) {
        winston.doMongoError (err, res)
      }
      else {
        console.log ('num affected', num)
        res.send ('deleted attachment', 200)
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

        var headers = {};
        var contentType = foundAttachment.contentType;
        if ( contentType &&
            ( ( contentType.indexOf('image/') === 0 )
            || ( contentType == 'application/pdf' ) ) ) {

          //headers['response-content-disposition']  = 'inline;filename=' + foundAttachment.filename;
        }

        var signedURL = s3Utils.signedURL(s3Path, routeAttachments.URL_EXPIRE_TIME_MINUTES, headers);
        res.redirect(signedURL);
      }
    });
  }
}
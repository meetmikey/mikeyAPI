var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , constants = require('../constants')
  , attachmentHelpers = require ('../lib/attachmentHelpers')
  , cloudStorageUtils = require (serverCommon + '/lib/cloudStorageUtils')
  , activeConnectionHelpers = require ('../lib/activeConnectionHelpers');

var routeAttachments = this;


exports.getAttachments = function(req, res) {
  attachmentHelpers.getFiles( req, res, false );

  // update last access time
  activeConnectionHelpers.updateLastAccessTime (req.user);
  
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
        console.log (foundAttachment)
        var path = cloudStorageUtils.getAttachmentPath(foundAttachment);
        var signedURL = cloudStorageUtils.signedURL(path, routeAttachments.URL_EXPIRE_TIME_MINUTES, foundAttachment);
        res.redirect(signedURL);
      }
    });
  }
}
var serverCommon = process.env.SERVER_COMMON;

var AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , mikeyAPIConstants = require ('../constants')
  , attachmentHelpers = require ('../lib/attachmentHelpers')
  , cloudStorageUtils = require (serverCommon + '/lib/cloudStorageUtils')
  , sqsConnect = require (serverCommon + '/lib/sqsConnect')
  , indexingHandler = require (serverCommon + '/lib/indexingHandler')
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

  AttachmentModel.findOne ({_id : attachmentId},
    function (err, foundAtt) {
      if (err) {
        winston.doMongoError(err, null, res);
      } else if (!foundAtt) {
        res.send ({'error' : 'bad attachmentId'}, 400);
      } else {
        if (String (foundAtt.userId) != userId) {
          res.send ({'error' : 'not authorized'}, 403);
        } else {
          foundAtt.isDeleted = true;

          foundAtt.save (function (err) {
            if (err) {
              winston.doMongoError (err, null, res);
            } else {
              // create delete from index job
              indexingHandler.createDeleteJobForDocument(userId, attachmentId, 'Attachment', function (err) {
                if (err) {
                  winston.doMongoError(err, null, res);
                } else {
                  res.send (200);
                }
              });
            }
          });
        }
      }
    });
}

exports.deleteAttachment = function (req, res) {

  var userId = req.user._id;
  var attachmentId = req.params.attachmentId;

  AttachmentModel.findOne ({_id : attachmentId},
    function (err, foundAtt) {
      if (err) {
        winston.doMongoError(err, null, res);
      } else if (!foundAtt) {
        res.send ({'error' : 'bad attachmentId'}, 400);
      } else {
        if (String (foundAtt.userId) != userId) {
          res.send ({'error' : 'not authorized'}, 403);
        } else {
          foundAtt.isDeleted = true;

          foundAtt.save (function (err) {
            if (err) {
              winston.doMongoError (err, null, res);
            } else {
              // create delete from index job
              indexingHandler.createDeleteJobForDocument(userId, attachmentId, 'Attachment', function (err) {
                if (err) {
                  winston.doMongoError(err, null, res);
                } else {
                  res.send (200);
                }
              });
            }
          });
        }
      }
    });
}

exports.putAttachment = function (req, res) {

  var userId = req.user._id;
  var attachmentId = req.params.attachmentId;

  var filterData = {
      _id: attachmentId
    , userId : userId
  }

  var updateData = {$set: {}};

  var setIsFavorite = false
  if (typeof req.body.isFavorite !== 'undefined') {
    setIsFavorite = true;
  }

  if (setIsFavorite && req.body.isFavorite == 'true' ) {
    updateData['$set']['isFavorite'] = true;
  } else if (setIsFavorite && req.body.isFavorite == 'false') {
    updateData['$set']['isFavorite'] = false;
  }

  // isLiked cannot be reversed
  var setIsLiked = false;
  if (typeof req.body.isLiked !== 'undefined' && req.body.isLiked === 'true') {
    setIsLiked = true;
    updateData['$set']['isLiked'] = true;
  }

  AttachmentModel.findOneAndUpdate( filterData, updateData, function (err, foundAtt) {
    if (err) {
      winston.doMongoError(err, null, res);

    } else if (!foundAtt) {
      res.send ({'error' : 'bad request'}, 400);
      
    } else {

      if (setIsLiked) {
        sesUtils.sendLikeEmail (false, foundAtt, req.user, function (err) {
          if (err) {
            winston.doError (err, null, res);
          } else {
            res.send (foundAtt, 200);
          }
        });
      } else {
        res.send (foundAtt, 200);
      }

      var invalidateJob = {
        _id : foundAtt._id
      }

      sqsConnect.addMessageToCacheInvalidationQueue (invalidateJob, function (err) {
        if (err) {
          winston.doError (err);
        }
      });

    }
  });
}

exports.goToAttachmentSignedURL = function(req, res) {
  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.doWarn('routeAttachments: getAttachments: missing userId');
    res.send(400, 'missing userId');
  } else if ( ( ! req ) || ( ! req.params ) || ( ! req.params.attachmentId ) ) {
    res.send(400, 'missing attachmentId');
  } else {
    var userId = req.user._id;
    var attachmentId = req.params.attachmentId;

    //Make sure the attachment belongs to this user...
    AttachmentModel.findOne({_id:attachmentId, userId:userId}, function(err, foundAttachment) {
      if ( err ) {
        winston.doMongoError(err, null, res);

      } else if ( ! foundAttachment ) {
        res.send(400, 'attachment not found');

      } else {
        var path = cloudStorageUtils.getAttachmentPath(foundAttachment);
        var signedURL = cloudStorageUtils.signedURL(path, mikeyAPIConstants.FILE_EXPIRE_TIME_MINUTES, foundAttachment);
        res.redirect(signedURL);
      }
    });
  }
}
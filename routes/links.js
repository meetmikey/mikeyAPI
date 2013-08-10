var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , _ = require ('underscore')
  , constants = require(serverCommon + '/constants')
  , sqsConnect = require (serverCommon + '/lib/sqsConnect')
  , smtpUtils = require (serverCommon + '/lib/smtpUtils')
  , indexingHandler = require (serverCommon + '/lib/indexingHandler')
  , linkHelpers = require('../lib/linkHelpers')

var routeLinks = this;

exports.getLinks = function(req, res) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.doWarn('routeLinks: getLinks: missing userId');
    res.send(400, 'missing userId');
    return;
  }

  var user = req.user;
  var userId = user._id;
  var before = req.query.before;
  var after = req.query.after;
  var limit = req.query.limit;
  var isFavorite = req.query.isFavorite;

  if (!isFavorite) {
    isFavorite = false;
  }

  if (!limit) {
    limit = 50
  }

  var query = LinkModel.find({userId:userId, 'isPromoted':true, 'isFollowed':true, 'isDeleted' : false, 'isFavorite' : isFavorite })

  if ( before && ( before != Infinity ) && ( before != 'Infinity' ) ) {
    query.where ('sentDate').lt(before);
  }

  if ( after && ( after != -Infinity ) && ( after != '-Infinity' ) ) {
    query.where('sentDate').gt(after);
  }

  if ( ! user.isPremium ) {
    var daysLimit = user.daysLimit;
    if ( ! daysLimit ) {
      winston.doError('user is not premium, but has no daysLimit', {userId: userId});

    } else {
      var currentTime = Date.now();
      var cutoffDate = new Date(currentTime - daysLimit*constants.ONE_DAY_IN_MS);
      if ( ( ! after ) || ( cutoffDate > new Date(after) ) ) {
        query.where('sentDate').gt(cutoffDate);
      }
    }
  }
      
  query.sort ('-sentDate')
    .limit (limit)
    .select(constants.DEFAULT_FIELDS_LINK)
    .exec(function(err, foundLinks) {
      if ( err ) {
        winston.doMongoError(err, null, res);
      } else {
        linkHelpers.addSignedURLs(foundLinks, userId)
        res.send( foundLinks );
      }
    }
  );
}


exports.getLinksByThread = function (req, res) {
  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.doWarn('routeLinks: getLinkByThread: missing userId');
    res.send(400, 'missing userId');
    return;
  }

  var user = req.user;
  var userId = user._id;
  var gmThreadId = req.params.gmThreadId;

  var query = LinkModel.find({userId:userId, 'isPromoted':true, 'isFollowed':true, 'gmThreadId' : gmThreadId})
      
  query.select(constants.DEFAULT_FIELDS_LINK)
    .exec(function(err, foundLinks) {
      if ( err ) {
        winston.doMongoError(err, null, res);
      } else {
        linkHelpers.addSignedURLs(foundLinks, userId);

        // TODO: filter out links that are "too old"
        res.send( foundLinks );
      }
    }
  );
}

exports.deleteLink = function (req, res) {

  var userId = req.user._id;
  var linkId = req.params.linkId;

  LinkModel.findOne ({_id : linkId},
    function (err, foundLink) {
      if (err) {
        winston.doMongoError(err, null, res);
      } else if (!foundLink) {
        res.send ({'error' : 'bad linkId'}, 400);
      } else {
        if (String (foundLink.userId) != userId) {
          res.send ({'error' : 'not authorized'}, 403);
        } else {
          foundLink.isDeleted = true;

          foundLink.save (function (err) {
            if (err) {
              winston.doMongoError (err, null, res);
            } else {
              // create delete from index job
              indexingHandler.createDeleteJobForDocument(userId, linkId, 'Link', function (err) {
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
    })
}


exports.putLink = function (req, res) {

  var userId = req.user._id;
  var linkId = req.params.linkId;

  var filterData = {
      _id: linkId
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

  LinkModel.findOneAndUpdate( filterData, updateData, function(err, foundLink) {
    if (err) {
      winston.doMongoError(err, null, res);

    } else if (!foundLink) {
      res.send ({'error' : 'bad request'}, 400);

    } else {

      if (setIsLiked) {
        smtpUtils.sendLikeEmail (true, foundLink, req.user, function (err) {
          if (err) {
            winston.doError (err, null, res);
          } else {
            res.send (foundLink, 200);
          }
        });
      } else {
        res.send (foundLink, 200);
      }


      var invalidateJob = {
        _id : foundLink._id
      }

      sqsConnect.addMessageToCacheInvalidationQueue (invalidateJob, function (err) {
        if (err) {
          winston.doError (err);
        }
      });
    }
  });
}

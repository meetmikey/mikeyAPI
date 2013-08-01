var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , constants = require(serverCommon + '/constants')
  , sqsConnect = require (serverCommon + '/lib/sqsConnect')
  , indexingHandler = require (serverCommon + '/lib/indexingHandler')
  , linkHelpers = require('../lib/linkHelpers')

var routeLinks = this;

exports.getLinks = function(req, res) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.doWarn('routeLinks: getLinks: missing userId');
    res.send(400, 'missing userId');
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

  isFavorite = ( req.body.isFavorite ) ? true : false;
  updateData = {$set:{
    isFavorite: isFavorite
  }};

  LinkModel.findOneAndUpdate( filterData, updateData, function(err, foundLink) {
    if (err) {
      winston.doMongoError(err, null, res);

    } else if (!foundLink) {
      res.send ({'error' : 'bad request'}, 400);

    } else {
      res.send (foundLink, 200);

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
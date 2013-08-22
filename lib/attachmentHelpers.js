var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , attachmentUtils = require(serverCommon + '/lib/attachmentUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , memcached = require (serverCommon + '/lib/memcachedConnect')
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , cloudStorageUtils = require(serverCommon + '/lib/cloudStorageUtils')
  , _ = require ('underscore')
  , scConstants = require (serverCommon + '/constants')
  , mikeyAPIConstants = require('../constants');

var attachmentHelpers = this;

exports.getAttachmentsById = function (attachmentIds, userId, isImage, callback) {
  
  var cachedIds = [];
  var nonCachedIds = [];

  if (attachmentIds.length == 0) {
    callback (null, []);
    return;
  }

  async.waterfall ([
    tryMemcached,
    doMongoSearch
  ], function (err, results) {
    if (err) {
      callback(err);

    } else {
      attachmentHelpers.addSignedURLs(results);
      attachmentHelpers.sortByDate( results );
      if ( isImage ) {
        //Turned off de-duping since it messes up the search result pagination stuff.
        //results = attachmentHelpers.dedupeFiles( results );
      }
      callback( null, results );
    }
  });

  function tryMemcached (asyncCb) {
    var memcacheResults = [];

    memcached.get (attachmentIds, function (err, results) {
      if (err) {
        winston.handleError (err);
        asyncCb (null, attachmentIds, []);
      } else if (results) {
        for (var key in results) {
          // TODO: update any signed URLs
          cachedIds.push (key);
          try {
            memcacheResults.push (new AttachmentModel (JSON.parse (results[key])));
          } catch (e) {
            winston.doError ('invalid document in cache', {msg : e.message, stack : e.stack, key : key});
          }
        }

        nonCachedIds = _.filter(attachmentIds, function(id){ return !(id in results); });

        asyncCb (null, nonCachedIds, memcacheResults);
      } else {
        asyncCb (null, attachmentIds, []);
      }
    });
  }

  function doMongoSearch (nonCachedIds, resultsToJoin, asyncCb) {

    var ratio = nonCachedIds.length/attachmentIds.length;
    winston.doInfo ('attachmentHelpers: doMongoSearch for caches misses', {missRatio : ratio, missNumber : nonCachedIds.length});

    if (ratio == 0) {
      asyncCb (null, resultsToJoin);
    } else {

      AttachmentModel.find({})
        .where ('_id').in(nonCachedIds)
        .select (scConstants.DEFAULT_FIELDS_ATTACHMENT)
        .exec (function (err, foundAttachments) {
          if ( err ) {
            asyncCb (winston.makeMongoError (err));
          } else {

            var allResults = foundAttachments.concat (resultsToJoin);

            memcached.setBatch (foundAttachments, function (err) {
              if (err) {
                winston.handleError (err);
              }

              asyncCb (null, allResults);
            });
          }
       });
    }

  }
}

exports.addSignedURLs = function( attachments ) {
  attachments.forEach( function( attachment ) {
    var imageCloudPath = '';
    if ( attachmentUtils.isAttachmentImage(attachment) ) {
      var suffix = "";
      if (attachment.attachmentThumbExists) {
        suffix = "_thumb";
      }

      imageCloudPath = cloudStorageUtils.getAttachmentPath(attachment) + suffix;
      //winston.doInfo ('imageCloudPath', {path : imageCloudPath});
    }

    if ( imageCloudPath ) {
      var signedURL = cloudStorageUtils.signedURL(imageCloudPath, mikeyAPIConstants.IMAGE_EXPIRE_TIME_MINUTES, attachment);
      //winston.doInfo('set signedURL on attachment', {signedURL: signedURL, attachment: attachment});
      attachment.image = signedURL;
    }
  });
}

exports.sortByDate = function (attachments) {
  attachments.sort (function (a, b) {
    return b.sentDate.getTime() - a.sentDate.getTime()
  });  
}


exports.getId = function (attachment) {
  return attachment.hash + '_' + attachment.fileSize
}

exports.dedupeFiles = function(filesInput) {
  var files = [];
  var fileKeys = [];
  if ( filesInput && filesInput.length ) {
    for ( var i=0; i<filesInput.length; i++ ) {
      var file = filesInput[i];
      var fileKey = attachmentUtils.getFileContentId( file );
      if ( fileKeys.indexOf( fileKey ) === -1 ) {
        fileKeys.push( fileKey );
        files.push( file );
      }
    }
  }
  return files;
}

exports.getFiles = function( req, res, getImagesInput ) {

  if ( ! req ) { winston.doMissingParamError('req', null, res); return; }
  if ( ! req.user ) { winston.doMissingParamError('req.user', null, res); return; }

  var user = req.user;
  var before = req.query.before;
  var after = req.query.after;
  var limit = req.query.limit;
  var isFavorite = false;
  if ( req.query.isFavorite && req.query.isFavorite != 'false' ) {
    isFavorite = true;
  }

  var getImages = false;
  if ( getImagesInput ) {
    getImages = true;
  }

  //Currently, there's just one route to get both favorite and non-favorite images, so we do both here and combine them.
  if ( getImages ) {
    async.parallel([
        //Need to ask for both favorite and non-favorite images
          function(parallelCallback) { attachmentHelpers.getFilesByCriteria( user, before, after, limit, getImages, false, parallelCallback ) }
        , function(parallelCallback) { attachmentHelpers.getFilesByCriteria( user, before, after, limit, getImages, true, parallelCallback ) }
      ], function( err, results ) {
        if ( err ) {
          winston.handleError( err, res );

        } else {
          var nonFavoriteImages = results[0];
          var favoriteImages = results[1];
          var allImages = nonFavoriteImages.concat( favoriteImages );
          allImages.sort( attachmentHelpers.sentDateComparator );
          res.send( allImages );
        }
      }
    );

  } else {
    attachmentHelpers.getFilesByCriteria( user, before, after, limit, getImages, isFavorite, function(err, files) {
      if ( err ) {
        winston.handleError( err, res );

      } else {
        res.send( files );
      }
    });
  }
}

exports.sentDateComparator = function( fileA, fileB ) {
  if ( ( ! fileA ) || ( ! fileA.sentDate ) || ( ! fileB ) || ( ! fileB.sentDate ) ) {
    return 0;
  }

  if ( fileA.sentDate < fileB.sentDate ) {
    return -1;
  } else if ( fileA.sentDate > fileB.sentDate ) {
    return 1;
  } else {
    return 0;
  }
}

exports.getFilesByCriteria = function( user, before, after, limit, getImages, isFavorite, callback ) {

  if ( ! user ) { callback( winston.makeMissingParamError('user') ); return; }

  var userId = user._id;

  if ( ! limit ) {
    if ( getImages ) {
      limit = mikeyAPIConstants.DEFAULT_IMAGE_RESOURCE_LIMIT;
    } else {
      limit = mikeyAPIConstants.DEFAULT_RESOURCE_LIMIT;
    }
  }

  var filter = {
      userId: userId
    , 'isPromoted': true
    , 'isImage': getImages
    , 'isDeleted': false
    , 'isFavorite': isFavorite
  };

  var query = AttachmentModel.find( filter );
  
  if ( before && ( before != Infinity ) && ( before != 'Infinity' ) ) {
    query.where('sentDate').lt(before);
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
    .select(scConstants.DEFAULT_FIELDS_ATTACHMENT)
    .exec(function(mongoErr, foundAttachments) {
      if ( mongoErr ) {
        callback( winston.makeMongoError( mongoErr ) );

      } else {
        var files;
        if ( getImages ) {
          files = attachmentHelpers.dedupeFiles( foundAttachments );
        } else {
          files = foundAttachments;
        }
        attachmentHelpers.addSignedURLs( files );
        callback( null, files );
      }
    });
}
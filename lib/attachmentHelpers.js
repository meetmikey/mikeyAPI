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

exports.getFilesByThread = function (req, res, getImages) {
  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.doWarn('routeAttachments: getAttachmentsByThread: missing userId');
    res.send(400, 'missing userId');
    return;
  }

  var user = req.user;
  var userId = user._id;
  var gmThreadId = req.params.gmThreadId;

  var query = AttachmentModel.find({userId:userId, 'isPromoted':true, 'isImage' : getImages, 'gmThreadId' : gmThreadId});
      
  query.select(constants.DEFAULT_FIELDS_ATTACHMENT)
    .exec(function(err, foundAttachments) {
      if ( err ) {
        winston.doMongoError(err, null, res);
      } else {

        if ( getImages ) {
          files = attachmentHelpers.dedupeFiles( foundAttachments );
        } else {
          files = foundAttachments;
        }
        attachmentHelpers.addSignedURLs(files);

        // TODO: filter out attachments that are "too old"
        res.send( files );
      }
    });
}


exports.getFiles = function(req, res, getImagesInput) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.doWarn('attachmentHelpers: getFiles: missing userId');
    res.send(400, 'bad request');
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

  var filter = {
      userId: userId
    , 'isPromoted': true
    , 'isDeleted' : false
    , 'isFavorite' : isFavorite
  };
  if ( getImages ) {
    filter['isImage'] = true;
  } else {
    filter['isImage'] = false;
  }

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
    .exec(function(err, foundAttachments) {
      if ( err ) {
        winston.doMongoError(err, null, res);
      } else {
        var files;
        if ( getImages ) {
          files = attachmentHelpers.dedupeFiles( foundAttachments );
        } else {
          files = foundAttachments;
        }
        attachmentHelpers.addSignedURLs( files );
        res.send( files );
      }
    });
}
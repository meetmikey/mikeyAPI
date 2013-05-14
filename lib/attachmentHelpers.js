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

exports.getAttachmentsById = function (attachmentIds, userId, callback) {
  
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
      callback (err);
    }
    else {

      attachmentHelpers.addSignedURLs(results);
      attachmentHelpers.sortByDate(results);

      var attachmentsAndImages = attachmentHelpers.splitOutImages( results );

      callback(null, attachmentsAndImages);
    }
  });

  function tryMemcached (asyncCb) {
    var memcacheResults = [];

    console.log ('attIds', attachmentIds);

    memcached.get (attachmentIds, function (err, results) {
      if (err) {
        winston.handleError (err);
        asyncCb (null, attachmentIds, []);
      } else if (results) {
        for (var key in results) {

          console.log ('key', key);

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
            });

            asyncCb (null, allResults);
          }
       });
    }

  }
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
      //winston.info('set signedURL: ' + signedURL + ' on attachment: ', attachment);
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

exports.getFiles = function(req, res, getImagesInput) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.warn('attachmentHelpers: getFiles: missing userId');
    res.send(400, 'bad request');
  }

  var userId = req.user._id;
  var before = req.query.before;
  var after = req.query.after;
  var limit = req.query.limit;

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
    , 'isPromoted': true
  };
  if ( getImages ) {
    filter['isImage'] = true;
  } else {
    filter['isImage'] = false;
  }

  var query = AttachmentModel.find( filter );
  
  if ( before && ( before != Infinity ) && ( before != 'Infinity' ) ) {
    query.where ('sentDate').lt (before)
  }

  if ( after && ( after != -Infinity ) && ( after != '-Infinity' ) ) {
    query.where ('sentDate').gt (after)    
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
        attachmentHelpers.addSignedURLs(files, userId);
        res.send( files );
      }
    });
}
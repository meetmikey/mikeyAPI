var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , async = require ('async')
  , memcached = require (serverCommon + '/lib/memcachedConnect')
  , mikeyAPIConstants = require('../constants')
  , scConstants = require(serverCommon + '/constants')
  , _ = require ('underscore')
  , cloudStorageUtils = require(serverCommon + '/lib/cloudStorageUtils')


var linkHelpers = this;


exports.getLinksById = function (linkIds, userId, callback) {
  
  var cachedIds = [];
  var nonCachedIds = [];

  if (linkIds.length == 0) {
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

      var linksToReturn = [];
      var linksSeen = {};

      linkHelpers.sortByDate(results);

      results.forEach (function (link) {
        var comparableURLHash = link.comparableURLHash;
        if (!(comparableURLHash in linksSeen)) {
          linksSeen[comparableURLHash] = 1;
          linksToReturn.push (link);
        }
      });

      linkHelpers.addSignedURLs( linksToReturn );

      callback (null, results);
    }
  });

  function tryMemcached (asyncCb) {
    var memcacheResults = [];

    memcached.get (linkIds, function (err, results) {

      if (err) {
        winston.handleError (err);
        asyncCb (null, linkIds, []);
      } else if (results) {

        for (var key in results) {
          cachedIds.push (key);
          try {
            // TODO: update any signed URLs
            memcacheResults.push (new LinkModel (JSON.parse (results[key])));
          } catch (e) {
            winston.doError ('invalid document in cache', {msg : e.message, key : key});
          }
        }

        nonCachedIds = _.filter(linkIds, function(id){ return !(id in results); });

        asyncCb (null, nonCachedIds, memcacheResults);
      } else {
        asyncCb (null, linkIds, []);
      }
    });
  }

  function doMongoSearch (nonCachedIds, resultsToJoin, asyncCb) {

    var ratio = nonCachedIds.length/linkIds.length;
    winston.doInfo ('linkHelpers: doMongoSearch for caches misses', {ratio : ratio, num : nonCachedIds.length});

    if (ratio == 0) {
      asyncCb (null, resultsToJoin);
    } else {
      LinkModel.find( {} )
        .where ('_id').in(nonCachedIds)
        .select(scConstants.DEFAULT_FIELDS_LINK)
        .exec (function (err, foundLinks){
          if ( err ) {
            asyncCb (winston.makeMongoError (err));
          } else {

            var allResults = foundLinks.concat (resultsToJoin);

            memcached.setBatch (foundLinks, function (err) {
              if (err) {
                winston.handleError (err);
              }

              asyncCb( null, allResults);
            });
          }
        })
      }
  }

}

exports.addSignedURLs = function( links ) {
  links.forEach (function (link) {
    if ( link.image ) {

      var suffix = "";
      if (link.imageThumbExists) {
        suffix = "_thumb";
      }

      var imageCloudPath = link.image + suffix;
      var signedURL = cloudStorageUtils.signedURL(imageCloudPath, mikeyAPIConstants.IMAGE_EXPIRE_TIME_MINUTES, link);
      //winston.doInfo('set signedURL on link', {signedURL: signedURL, link: link});
      link.image = signedURL;
    }
  })
}

exports.sortByDate = function (links) {
  links.sort (function (a, b) {
    return b.sentDate.getTime() - a.sentDate.getTime()
  });  
}

var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , mikeyAPIConstants = require('../constants')
  , cloudStorageUtils = require(serverCommon + '/lib/cloudStorageUtils')
  , mongoUtils = require(serverCommon + '/lib/mongoUtils')


var linkHelpers = this;

exports.getLinksByHash = function (linkHashes, userId, scores, callback) {

  var filter = {
      userId: userId
    , shardKey: mongoUtils.getShardKeyHash( userId )
    , 'isPromoted': true
  };
  
  LinkModel.find( filter )
    .where ('comparableURLHash').in(linkHashes)
    .select(mikeyAPIConstants.DEFAULT_FIELDS_LINK)
    .exec (function (err, foundLinks){
      if ( err ) {
        winston.doMongoError(err, res);
        callback (err);
      } else {
        var linksToReturn = []
        var linksSeen = {}

        foundLinks.forEach (function (link) {
          var comparableURLHash = link.comparableURLHash
          if (!(comparableURLHash in linksSeen)) {
            linksSeen[comparableURLHash] = 1
            linksToReturn.push (link)
          }
          else {
            winston.info ('duplicate link, not adding', {comparableURLHash : comparableURLHash})
          }
        })

        linkHelpers.sortByScore(linksToReturn, scores);
        linkHelpers.addSignedURLs( linksToReturn );
        callback( null, linksToReturn);
      }
    })
}

exports.addSignedURLs = function(links, userId) {
  links.forEach (function (link) {
    if ( link.image ) {
      var imageCloudPath = link.image;
      var signedURL = cloudStorageUtils.signedURL(imageCloudPath, mikeyAPIConstants.URL_EXPIRE_TIME_MINUTES, link);
      //winston.info('set signedURL: ' + signedURL + ' on link: ', link);
      link.image = signedURL;
    }
  })
}

exports.sortByScore = function (links, scores) {
  links.sort (function (a, b) {
    return scores[b.comparableURLHash] - scores[a.comparableURLHash]
  })
}

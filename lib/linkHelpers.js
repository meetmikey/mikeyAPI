var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , mikeyAPIConstants = require('../constants')
  , cloudStorageUtils = require(serverCommon + '/lib/cloudStorageUtils')
  , mongoUtils = require(serverCommon + '/lib/mongoUtils')


var linkHelpers = this;


exports.getLinksById = function (linkIds, userId, callback) {
  
  LinkModel.find( {} )
    .where ('_id').in(linkIds)
    .select(mikeyAPIConstants.DEFAULT_FIELDS_LINK)
    .exec (function (err, foundLinks){
      if ( err ) {
        winston.doMongoError(err, null, res);
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

          /*
          if (String(link.userId) != String(userId)) {
            console.log (link.userId)
            console.log (userId)
            console.log (link.userId  == userId)
            console.log ('ACL PROBLEM')
            //winston.doError ('ACL PROBLEM', {link : link});
          }*/


        })

        linkHelpers.sortByDate(linksToReturn);
        linkHelpers.addSignedURLs( linksToReturn );
        callback( null, linksToReturn);
      }
    })
}

exports.addSignedURLs = function(links, userId) {
  links.forEach (function (link) {
    if ( link.image ) {

      var suffix = "";
      if (link.imageThumbExists) {
        suffix = "_thumb";
      }

      var imageCloudPath = link.image + suffix;
      var signedURL = cloudStorageUtils.signedURL(imageCloudPath, mikeyAPIConstants.IMAGE_EXPIRE_TIME_MINUTES, link);
      //winston.info('set signedURL: ' + signedURL + ' on link: ', link);
      link.image = signedURL;
    }
  })
}

exports.sortByDate = function (links) {
  links.sort (function (a, b) {
    return b.sentDate.getTime() - a.sentDate.getTime()
  });  
}

exports.sortByScore = function (links, scores) {
  links.sort (function (a, b) {
    return scores[b.comparableURLHash] - scores[a.comparableURLHash]
  })
}

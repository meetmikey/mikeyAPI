var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , constants = require('../constants')


var linkHelpers = this;

exports.getLinksByHash = function (linkHashes, userId, scores, callback) {

  LinkModel.find({userId:userId, 'isPromoted':true})
    .where ('comparableURLHash').in(linkHashes)
    .select(constants.DEFAULT_FIELDS_LINK)
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

        linkHelpers.sortByScore(linksToReturn, scores)
        callback( null, linksToReturn);
      }
    })
}

exports.addSignedURLs = function(links, userId) {
  links.forEach (function (link) {
    if ( link.image ) {
      var imageS3Path = link.image;
      var signedURL = s3Utils.signedURL(imageS3Path, constants.URL_EXPIRE_TIME_MINUTES);
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

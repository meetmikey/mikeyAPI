var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , constants = require('../constants')


var linkHelpers = this;

exports.getLinksByHash = function (linkHashes, userId, scores, callback) {
  console.log (scores)

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
          if (!(link.comparableURLHash in linksSeen)) {
            linksSeen[link.comparableURLHash] = 1
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


exports.sortByScore = function (links, scores) {
  links.sort (function (a, b) {
    return scores[b.comparableURLHash] - scores[a.comparableURLHash]
  })
}

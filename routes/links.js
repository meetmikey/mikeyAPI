var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , constants = require('../constants')
  , linkHelpers = require('../lib/linkHelpers')

var routeLinks = this;

exports.getLinks = function(req, res) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.warn('routeLinks: getLinks: missing userId');
    res.send(400, 'missing userId');
  }

  var userId = req.user._id;
  var before = req.query.before;
  var after = req.query.after;
  var limit = req.query.limit;

  if (!limit) {
    limit = 50
  }

  if (constants.USE_SPOOFED_USER) {
    userId = constants.SPOOFED_USER_ID;
  }

  var query = LinkModel.find({userId:userId, 'isPromoted':true})

  if (before) {
    query.where ('sentDate').lt (before)
  }

  if (after) {
    query.where ('sentDate').gt (after)
  }
      
  query.sort ('-sentDate')
    .limit (limit)
    .select(constants.DEFAULT_FIELDS_LINK)
    .exec(function(err, foundLinks) {
      if ( err ) {
        winston.doMongoError(err, res);
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

  LinkModel.update ({userId : userId, _id : linkId}, 
    {$set : {isDeleted : true}}, 
    function (err, num) {
      if (err) {
        winston.doMongoError (err, res)
      }
      else {
        res.send (200)
      }
    });

}

exports.deleteLinkBulk = function (req, res) {

  var userId = req.user._id;
  var linkIds = req.body.linkIds;

  if (!linkIds) {
    res.send ('bad request: must specify linkIds', 400);
    return;
  }

  LinkModel.update ({userId : userId, _id : {$in : linkIds}}, 
    {$set : {isDeleted : true}},
    {multi : true},
    function (err, num) {
      if (err) {
        winston.doMongoError (err, res)
      }
      else {
        res.send (200)
      }
    });
}
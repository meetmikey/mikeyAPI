var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , constants = require('../constants')

var routeLinks = this;

exports.getLinks = function(req, res) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.warn('routeLinks: getLinks: missing userId');
    res.send(400, 'missing userId');
  }
  var userId = req.user._id;
  if (constants.USE_SPOOFED_USER) {
    userId = constants.SPOOFED_USER_ID;
  }

  var fields = 'url sentDate sender recipients image title text';

  LinkModel.find({userId:userId, 'isPromoted':true}, fields, function(err, foundLinks) {
    if ( err ) {
      winston.doMongoError(err, res);
    } else {
      res.send( foundLinks );
    }
  });
}

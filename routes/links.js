var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston

var routeLinks = this;

exports.getLinks = function(req, res) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.warn('routeLinks: getLinks: missing userId');
    res.send(400, 'missing userId');
  }
  var userId = req.user._id;
  
  var fields = 'url sentDate sender recipients image';

  LinkModel.find({userId:userId, 'isPromoted':true}, fields, function(err, foundLinks) {
    if ( err ) {
      winston.doMongoError(err, res);
    } else {
      winston.info('foundLinks: ', foundLinks);
      res.send( foundLinks );
    }
  });
}
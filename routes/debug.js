var serverCommon = process.env.SERVER_COMMON;

var winston = require(serverCommon + '/lib/winstonWrapper').winston;

exports.postClientBug = function(req, res) {

  var type = req.body.bugType;
  var info = req.body.info;
  var userEmail = req.body.userEmail;

  winston.doWarn ('bug posted from client', {type : type, info : info, email : userEmail});

  res.send (200);
}
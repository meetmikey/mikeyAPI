var serverCommon = process.env.SERVER_COMMON;

var winston = require(serverCommon + '/lib/winstonWrapper').winston;

exports.postClientBug = function(req, res) {

  var type = req.body.bugType;
  var data = req.body.data;
  var userEmail = req.body.userEmail;

  winston.doError ('Bug posted from client', {type : type, data : data, email : userEmail});

  res.send (200);
}
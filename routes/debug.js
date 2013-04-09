var serverCommon = process.env.SERVER_COMMON;

var winston = require(serverCommon + '/lib/winstonWrapper').winston
    , fs = require ('fs')
    , constants = require ('../constants');

exports.postClientBug = function(req, res) {

  var type = req.body.type;
  var data = req.body.data;
  var userEmail = req.body.userEmail;

  winston.doError ('Bug posted from client', {type : type, selector : data.selector, email : userEmail});


  if (data && data.dom) {

    var path = constants.DOM_DIR + userEmail + '_' + data.selector + '_' + new Date(Date.now()).toISOString();
    winston.info (path);
    fs.writeFile (path, data.dom, function (err) {
      if (err) {
        winston.doError ('Error writing dom sent from client to disk');
      }
    });
  }

  res.send (200);
}
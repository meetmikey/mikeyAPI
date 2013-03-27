var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , AttachmentModel = require (serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , constants = require('../constants')
  , linkHelpers = require('../lib/linkHelpers')

var routeCounts = this;

exports.getCounts = function(req, res) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.warn('routeLinks: getLinks: missing userId');
    res.send(400, 'missing userId');
  }

  var userId = req.user._id;


  async.parallel ([
    function (callback) {    
      LinkModel.count({userId:userId, 'isPromoted':true}), function (err, count) {
        if (err) { return callback (winston.makeMongoError (err)); }
        callback (count);
      }
    },
    function (callback) {    
      AttachmentModel.count({userId:userId, 'isPromoted':true, isImage : false}), function (err, count) {
        if (err) { return callback (winston.makeMongoError (err)); }
        callback (count);
      }
    },
    function (callback) {    
      AttachmentModel.count({userId:userId, 'isPromoted':true, isImage : true}), function (err, count) {
        if (err) { return callback (winston.makeMongoError (err)); }
        callback (count);
      }
    }], function (err, data) {
        if (err){
          res.send ({error : 'internal error'}, 500);
        }
        else {
          res.send ({'links' : data[0], 'files' : data[1], 'images' : data[2]});
        }
    });

}
var serverCommon = process.env.SERVER_COMMON;

var utils = require(serverCommon + '/lib/utils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require (serverCommon + '/lib/winstonWrapper').winston

exports.getAttachments = function(req, res) {

  //TEMP!
  var userId = '50f75659017ec66733000004';

  AttachmentModel.find({userId:userId}, function(err, foundAttachments) {
    if ( ! utils.checkMongo(err, 'getAttachments', 'AttachmentModel.find') ) {
      res.send({'error': 'mongo failure'}, 400);
    } else {
      winston.info('got Attachments');
      res.send(foundAttachments);
    }
  });
}
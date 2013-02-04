var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , s3Utils = require(serverCommon + '/lib/s3Utils')

var routeAttachments = this;

exports.URL_EXPIRE_TIME_MINUTES = 60;

exports.getAttachments = function(req, res) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    res.send('missing userId', 400);
  }
  var userId = req.user._id;

  var fields = 'filename contentType size sentDate sender image';

  AttachmentModel.find({userId:userId}, fields, function(err, foundAttachments) {
    if ( ! utils.checkMongo(err, 'getAttachments', 'AttachmentModel.find') ) {
      res.send({'error': 'mongo failure'}, 400);
    } else {
      winston.info('got Attachments');
      routeAttachments.addSignedURLs(foundAttachments, function(err) {
        if ( err ) {
          winston.error('routeAttachments: getAttachments: error while adding signedURLs: ' + err);
        }
        winston.info('foundAttachments: ', foundAttachments);
        res.send( foundAttachments );
      });
    }
  });
}

exports.addSignedURLs = function(dbAttachments, callback) {
  var expires = new Date();
  expires.setMinutes(expires.getMinutes() + routeAttachments.URL_EXPIRE_TIME_MINUTES);

  if ( dbAttachments && dbAttachments.length ) {
    async.forEach(dbAttachments,
      
      function(attachment, forEachCallback) {
        var path = conf.aws.s3Folders.attachments + '/' + attachment._id;
        var signedURL = s3Utils.client.signedUrl(path, expires);
        attachment.signedURL = signedURL;

        //winston.info('set signedURL: ' + signedURL + ' on attachment: ', attachment);

        if ( mailUtils.isImage(attachment) && ( ! attachment.image ) ) {
          attachment.image = signedURL;
        }
        forEachCallback();        
      },
      function(err) {
        callback(err);
      }
    );
  }
}
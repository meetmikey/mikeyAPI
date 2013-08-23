var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , scConstants = require (serverCommon + '/constants')
  , mikeyAPIConstants = require('../constants')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , LinkModel = require(serverCommon + '/schema/link').LinkModel
  , emailTemplates = require(serverCommon + '/lib/emailTemplates')

var emailTemplateHelpers = this;

exports.getLikeEmailTemplate = function( user, modelId, modelType, callback ) {

  if ( ! user ) { callback( winston.makeMissingParamError('user') ); return; }
  if ( ! modelId ) { callback( winston.makeMissingParamError('modelId') ); return; }
  if ( ! modelType ) { callback( winston.makeMissingParamError('modelType') ); return; }

  var mongooseModel = AttachmentModel;
  if ( modelType == 'link' ) {
    mongooseModel = LinkModel;
  }

  mongooseModel.findById( modelId, function(mongoErr, model) {
    if ( mongoErr ) {
      callback( winston.makeMongoError( mongoErr ) );

    } else if ( ! model ) {
      callback( winston.makeError('no model') );

    } else {
      emailTemplates.getLikeTextAndHTML( user, model, modelType, function(err, text, html) {
        if ( err ) {
          callback( err );

        } else {
          callback( null, text, html );
        }
      });
    }
  });
}
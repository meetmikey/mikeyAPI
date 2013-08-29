var serverCommon = process.env.SERVER_COMMON;

var emailTemplates = require(serverCommon + '/lib/emailTemplates')
	, winston = require(serverCommon + '/lib/winstonWrapper').winston
	, AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
	, LinkModel = require(serverCommon + '/schema/link').LinkModel

var testTemplates = this;

exports.renderLikeEmailTemplate = function( req, res ) {

  var userId = '52180cb730e2030e0200000a';
	var type = 'attachment';
  var mongooseModel = AttachmentModel;
  var modelId = '52180e06a342461f02000339';

  if ( req && req.query && req.query.type && req.query.type == 'link' ) {
  	type = 'link';
  	modelId = '521d2c15320e405b1100001d'; //image
    modelId = '521e45d3853611650d00000a'; //no image
  	mongooseModel = LinkModel;

  } else if ( req && req.query && req.query.type && req.query.type == 'image' ) {
  	type = 'image';
  	modelId = '52180d63a342461f0200008c';
  }

  UserModel.findById( userId, function(mongoErr, user) {
    if ( mongoErr ) {
      winston.doMongoError( mongoErr, null, res );

    } else if ( ! user ) {
      winston.doError('no user', null, res);

    } else {
      mongooseModel.findById( modelId, function(mongoErr, model) {
      	if ( mongoErr ) {
      		winston.doMongoError( mongoErr, null, res );

      	} else if ( ! model ) {
      		winston.doError('no model', null, res);

      	} else {
          var isPreview = true;
    		  emailTemplates.getLikeEmail( user, model, type, isPreview, function(err, text, html, attachments) {
    		  	if ( err ) {
    		  		winston.handleError( err, res );

    		  	} else if ( ! html ) {
    		  		winston.doError('no html', null, res);

    		  	} else {
    		  		res.send( html );
    		  	}
    		  });
      	}
      });
    }
  });
}
var serverCommon = process.env.SERVER_COMMON;

var emailTemplates = require(serverCommon + '/lib/emailTemplates')
	, winston = require(serverCommon + '/lib/winstonWrapper').winston
	, AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
	, LinkModel = require(serverCommon + '/schema/link').LinkModel

var testTemplates = this;

exports.renderLikeEmailTemplate = function( req, res ) {

	var type = 'attachment';
  var senderName = 'Leeroy Jenkins';
  var mongooseModel = AttachmentModel;
  var modelId = '52156570f5f29f8c1a000632';

  if ( req && req.query && req.query.type && req.query.type == 'link' ) {
  	type = 'link';
  	modelId = '5215650bf5f29f8c1a000270';
  	mongooseModel = LinkModel;

  } else if ( req && req.query && req.query.type && req.query.type == 'image' ) {
  	type = 'image';
  	modelId = '5215649ef5f29f8c1a000093';
  }

  mongooseModel.findById( modelId, function(mongoErr, model) {
  	if ( mongoErr ) {
  		winston.doMongoError( mongoErr, null, res );

  	} else if ( ! model ) {
  		winston.doError('no model', null, res);

  	} else {
		  emailTemplates.getLikeTextAndHTML( model, type, senderName, function(err, text, html) {
		  	if ( err ) {
		  		winston.handleError( err, res );

		  	} else if ( ! html ) {
		  		winston.doError('no html', null, res);

		  	} else {
		  		res.send( html );
		  	}
		  });
  	}
  })
}
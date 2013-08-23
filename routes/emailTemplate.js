var serverCommon = process.env.SERVER_COMMON;

var winston = require(serverCommon + '/lib/winstonWrapper').winston
  , emailTemplateHelpers = require('../lib/emailTemplateHelpers')

var routeEmailTemplate = this;

exports.getLikeEmailTemplate = function( req, res ) {

	var user = req.user;
	var modelId = req.query.modelId;
	var modelType = req.query.modelType;

	emailTemplateHelpers.getLikeEmailTemplate( user, modelId, modelType, function(err, templateText, templateHTML) {
		if ( err ) {
			winston.handleError( err, res );

		} else if ( ! templateHTML ) {
			winston.doError('empty template HTML', null, res);

		} else {
			res.send( templateHTML );
		}
	});
}
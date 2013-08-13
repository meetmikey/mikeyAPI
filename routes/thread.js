var serverCommon = process.env.SERVER_COMMON;

var winston = require(serverCommon + '/lib/winstonWrapper').winston
  , UserModel = require(serverCommon + '/schema/user').UserModel
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , LinkModel = require(serverCommon + '/schema/link').LinkModel
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , utils = require(serverCommon + '/lib/utils')
  , async = require('async')
  , attachmentHelpers = require('../lib/attachmentHelpers')
  , linkHelpers = require('../lib/linkHelpers')

var routeThread = this;

exports.getResources = function(req, res) {
	var threadHex = req.params.threadHex;
	var userEmail = req.query.userEmail;

	var gmThreadId = mailUtils.getDecimalValue( threadHex );
	if ( ! gmThreadId ) {
		winston.doError('no gmThreadId', {threadHex: threadHex});
		res.send( 400 );

	} else {
		UserModel.findOne( {email: userEmail}, function(mongoErr, foundUser) {
			if ( mongoErr ) {
				winston.doMongoError( mongoErr );
				res.send( 400 );

			} else if ( ! foundUser ) {
				winston.doError('no user', {userEmail: userEmail});
				res.send( 400 );

			} else {
				routeThread.getResourcesByThreadId( foundUser._id, gmThreadId, function(err, resources) {
					if ( err ) {
						winston.handleError( err );
						res.send( 400 );

					} else {
						res.send( resources );
					}
				});
			}
		});
	}
}

exports.getResourcesByThreadId = function( userId, gmThreadId, callback ) {

	if ( ! userId ) { callback ( winston.makeMissingParamError('userId') ); return; }
	if ( ! gmThreadId ) { callback ( winston.makeMissingParamError('gmThreadId') ); return; }

	async.parallel([
			function(parallelCallback) { routeThread.getAttachmentsByThreadId( userId, gmThreadId, parallelCallback ); }
		, function(parallelCallback) { routeThread.getLinksByThreadId( userId, gmThreadId, parallelCallback ); }

	], function( err, parallelResults ) {
		if ( err ) {
			callback( err );

		} else {
			var results = {
					attachments: parallelResults[0].attachments
				, images: parallelResults[0].images
				, links: parallelResults[1]
			}
			callback( null, results );
		}
	});
}

//calls back with an object that has 'attachments' and 'images', which are arrays
exports.getAttachmentsByThreadId = function( userId, gmThreadId, callback ) {

	if ( ! userId ) { callback ( winston.makeMissingParamError('userId') ); return; }
	if ( ! gmThreadId ) { callback ( winston.makeMissingParamError('gmThreadId') ); return; }

	var filter = {
			userId: userId
		, gmThreadId: gmThreadId
	};

	var results = {
			attachments: []
		, images: []
	};

	AttachmentModel.find( filter, function(mongoErr, mongoResults) {
		if ( mongoErr ) {
			callback( winston.makeMongoError( mongoErr ) );

		} else if ( ! utils.isArray( mongoResults ) ) {
			callback( null, results );

		} else {
			attachmentHelpers.addSignedURLs( mongoResults );
			while ( file = mongoResults.shift() ) {
				if ( file.isImage ) {
					results.images.push( file );
				} else {
					results.attachments.push( file );
				}
			}
			callback( null, results );
		}
	});
}

//calls back with an array of links
exports.getLinksByThreadId = function( userId, gmThreadId, callback ) {

	if ( ! userId ) { callback ( winston.makeMissingParamError('userId') ); return; }
	if ( ! gmThreadId ) { callback ( winston.makeMissingParamError('gmThreadId') ); return; }

	var filter = {
			userId: userId
		, gmThreadId: gmThreadId
	};

	LinkModel.find( filter, function(mongoErr, mongoResults) {
		if ( mongoErr ) {
			callback( winston.makeMongoError( mongoErr ) );

		} else {
			linkHelpers.addSignedURLs( mongoResults );
			callback( null, mongoResults );
		}
	});
}
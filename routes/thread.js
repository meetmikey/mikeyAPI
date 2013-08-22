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

exports.getResources = function( req, res ) {

	if ( ! req ) { winston.doMissingParamError('req', null, res); return; }
  if ( ! req.user ) { winston.doMissingParamError('req.user', null, res); return; }

	var user = req.user;
	var userId = user._id;
	var threadHex = req.params.threadHex;

	var gmThreadId = mailUtils.getDecimalValue( threadHex );
	if ( ! gmThreadId ) {
		winston.doMissingParamError('gmThreadId', {threadHex: threadHex}, res);

	} else {
		async.parallel([
				function(parallelCallback) { routeThread.getAttachmentsByThreadId( userId, gmThreadId, parallelCallback ); }
			, function(parallelCallback) { routeThread.getLinksByThreadId( userId, gmThreadId, parallelCallback ); }

		], function( err, parallelResults ) {
			if ( err ) {
				winston.handleError( err, res );

			} else {
				var results = {
						attachments: parallelResults[0].attachments
					, images: parallelResults[0].images
					, links: parallelResults[1]
				}
				res.send( results );
			}
		});
	}
}

//calls back with an object that has 'attachments' and 'images', which are arrays
exports.getAttachmentsByThreadId = function( userId, gmThreadId, callback ) {

	if ( ! userId ) { callback ( winston.makeMissingParamError('userId') ); return; }
	if ( ! gmThreadId ) { callback ( winston.makeMissingParamError('gmThreadId') ); return; }

	var filter = {
			userId: userId
		, gmThreadId: gmThreadId
    , isPromoted: true
    , isDeleted: false
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
		, isPromoted: true
		, isFollowed: true
    , isDeleted: false
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
var serverCommon = process.env.SERVER_COMMON;

var attachmentHelpers = require ('../lib/attachmentHelpers')

var routeImages = this;

exports.getImages = function(req, res) {
  attachmentHelpers.getFiles( req, res, true );
}
var serverCommon = process.env.SERVER_COMMON;

var LinkModel = require(serverCommon + '/schema/link').LinkModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , constants = require('../constants')

exports.getLinksByHash = function (attachmentHashes, userId, scores,callback) {
  callback (null, [])
}
var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , s3Utils = require(serverCommon + '/lib/s3Utils')
  , constants = require('../constants')

var routeSearch = this;

exports.URL_EXPIRE_TIME_MINUTES = 30;

exports.getSearchResults = function(req, res) {

  var search = req.query.query
  var userId = req.user._id;
  var onlyUsePrefix = false
  var from = 0
  var size = 10

  routeSearch.validateSearchQuery (req, function (errors) {
    if (errors) {
      res.send (errors, 400);
      return;
    }
  })

  res.send ({'attachments' : [], 'links' : []})

}

exports.validateSearchQuery = function (req, callback) {
  if (req.query.from) {
    req.assert('from', 'invalid parameter for from').isInt()
    from = req.query.from
  }

  if (req.query.size) {
    req.assert('size', 'invalid parameter for size').isInt()
    size = req.query.size
  }

  if (req.query.onlyUsePrefix) {
    req.assert ('onlyUsePrefix', 'invalid parameter for onlyUsePrefix').isBoolean()
    onlyUsePrefix = req.query.onlyUsePrefix
  }

  req.assert('query', 'Invalid query param').notEmpty()

  var errors = req.validationErrors();

  callback (errors)

}
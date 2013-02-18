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

  // defaults
  var searchOptions = {
    query : req.query.query,
    from : 0,
    size : 10
  }

  var userId = req.user._id

  routeSearch.validateSearchQuery (req, searchOptions, function (errors) {
    if (errors) {
      res.send (errors, 400);
      return;
    }
  })

  res.send ({'attachments' : [], 'links' : []})

}

exports.validateSearchQuery = function (req, searchOptions, callback) {
  if (req.query.from) {
    req.assert('from', 'invalid parameter for from').isInt()
    searchOptions.from = req.query.from
  }

  if (req.query.size) {
    req.assert('size', 'invalid parameter for size').isInt()
    searchOptions.size = req.query.size
  }

  req.assert('query', 'Invalid query param').notEmpty()

  var errors = req.validationErrors()

  callback (errors)

}
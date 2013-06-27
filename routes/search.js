var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , searchHelpers = require ('../lib/searchHelpers')
  , constants = require('../constants')

var routeSearch = this;

exports.getSearchResults = function(req, res) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.doWarn('routeLinks: getLinks: missing userId');
    res.send(400, 'missing userId');
  }

  var user = req.user;
  var userId = user._id;
  var daysLimit = null;
  if ( ! user.isPremium ) {
    if ( ! user.daysLimit ) {
      winston.doError('user is not premium, but has not daysLimit', {userId: userId});
    } else {
      daysLimit = user.daysLimit;
    }
  }


  // defaults
  var searchOptions = {
      query: req.query.query
    , from: 0
    , size: 80
    , userId: userId
    , daysLimit: daysLimit
  }

  routeSearch.validateSearchQuery (req, searchOptions, function (errors) {
    if (errors) {
      res.send (errors, 400);
      return;
    }
    else {
      doSearch ();
    }
  })

  function doSearch() {
    searchHelpers.doSearch (searchOptions.query, searchOptions.userId, searchOptions.from, searchOptions.size, searchOptions.daysLimit,
      function (err, result) {
      if (err) {
        res.send ({'error' : err}, 500)
      }
      else {
        res.send (result)
      }
    })
  }


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

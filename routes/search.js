var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , mailUtils = require(serverCommon + '/lib/mailUtils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , searchHelpers = require ('../lib/searchHelpers')
  , mikeyAPIConstants = require('../constants')

var routeSearch = this;

exports.getSearchOptions = function(req, callback) {

  if ( ( ! req ) || ( ! req.user ) || ( ! req.user._id ) ) {
    winston.doWarn('routeLinks: getLinks: missing userId');
    callback( 'missing userId');
    return;
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

  var fromIndex = 0;
  if ( req.query.fromIndex ) {
    fromIndex = req.query.fromIndex;
  }

  // defaults
  var searchOptions = {
      query: req.query.query
    , fromIndex: fromIndex
    , size: mikeyAPIConstants.DEFAULT_RESOURCE_LIMIT
    , userId: userId
    , daysLimit: daysLimit
  }

  callback(null, searchOptions);
}

exports.getSearchResults = function(req, res) {

  routeSearch.getSearchOptions( req, function(errorMessage, searchOptions) {
    if ( errorMessage ) {
      res.send( errorMessage, 400 );

    } else {
      routeSearch.validateSearchQuery (req, searchOptions, function (errors) {
        if (errors) {
          res.send( errors, 400 );

        } else {
          searchHelpers.doSearch (searchOptions.query, searchOptions.userId, searchOptions.fromIndex, searchOptions.size, searchOptions.daysLimit,
            function (err, result) {
              if (err) {
                res.send( {'error' : err}, 500 );

              } else {
                res.send( result );
              }
            }
          );
        }
      });
    }
  });
}

exports.getImageSearchResults = function(req, res) {

  routeSearch.getSearchOptions( req, function(errorMessage, searchOptions) {
    if ( errorMessage ) {
      res.send(errorMessage, 400);

    } else {
      searchOptions.size = mikeyAPIConstants.DEFAULT_IMAGE_RESOURCE_LIMIT;
      routeSearch.validateSearchQuery( req, searchOptions, function(errors) {
        if (errors) {
          res.send(errors, 400);

        } else {
          var filteredQuery = searchHelpers.filterGmailSearchQuery(searchOptions.query);
          if (filteredQuery.query == '') {
            res.send([]);

          } else {
            searchHelpers.doImageSearch( filteredQuery, searchOptions.userId, searchOptions.fromIndex, searchOptions.size, searchOptions.daysLimit
              , function (err, result) {
                if (err) {
                  res.send ({'error' : err}, 500)

                } else {
                  res.send( result );
                }
              }
            );
          }
        }
      });
    }
  });
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

var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , util = require('util')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , esUtils = require (serverCommon + '/lib/esUtils')
  , attachmentHelpers = require ('./attachmentHelpers')
  , linkHelpers = require ('./linkHelpers')
  , mikeyAPIConstants = require ('../constants')
  , constants = require(serverCommon + '/constants')

var searchHelpers = this;

exports.INDEX_TYPE = 'document';

exports.doSearch = function (query, userId, fromIndex, size, daysLimit, searchCallback) {

  var filteredQuery = searchHelpers.filterGmailSearchQuery (query);
  winston.doInfo('filtered', {filteredQuery: filteredQuery});

  if (filteredQuery.query == "") {
    searchCallback (null, {'attachments' : [], 'links': [], 'images' : []});
    return;
  }

  async.parallel ([
    function (callback) {
      searchHelpers.doAttachmentSearch( filteredQuery, userId, fromIndex, size, daysLimit, callback );
    },
    function (callback) {
      searchHelpers.doImageSearch( filteredQuery, userId, fromIndex, size, daysLimit, callback );
    },
    function (callback) {
      searchHelpers.doLinkSearch( filteredQuery, userId, fromIndex, size, daysLimit, callback );
    }
  ], function (err, data) {

    if (err) {
      winston.handleError (err);
      searchCallback ('internal error');

    } else {
      searchCallback(null, {'attachments' : data[0], 'images': data[1], 'links': data[2]});
    }
  });
}

exports.doAttachmentSearch = function( filteredQuery, userId, fromIndex, size, daysLimit, callback ) {
  searchHelpers.doFileSearch( filteredQuery, userId, fromIndex, size, daysLimit, false, callback );
}

exports.doImageSearch = function( filteredQuery, userId, fromIndex, size, daysLimit, callback ) {
  searchHelpers.doFileSearch( filteredQuery, userId, fromIndex, size, daysLimit, true, callback );
}

exports.doFileSearch = function( filteredQuery, userId, fromIndex, size, daysLimit, isImage, callback ) {

  var startAttachmentSearch = Date.now();
  var indexAlias = esUtils.getIndexAliasForUser( userId );
  var searchQuery = searchHelpers.getSearchQuery(filteredQuery, false, userId, fromIndex, size, daysLimit, isImage);

  esUtils.search( indexAlias, searchHelpers.INDEX_TYPE, searchQuery, function( err, responseData ) {
    if ( err ) {
      callback( winston.makeError('Error in file search', {error : err}) );

    } else {
      // process the data
      var ids = [];
      var scores = [];

      var endAttachmentSearch = Date.now ();

      winston.doInfo ('File search elapsed time', {time : (endAttachmentSearch - startAttachmentSearch)/1000});
      var startDbPull = Date.now();

      searchHelpers.extractDataFromHits( responseData, false, ids, scores );

      attachmentHelpers.getAttachmentsById( ids, userId, isImage, function( err, attachments ) {
        if ( err ) {
          callback( winston.makeMongoError(err) );

        } else {
          var endDbPull = Date.now ();
          winston.doInfo ('File dbpull elapsed time', {time : (endDbPull - startDbPull)/1000});
          callback(null, attachments);
        }
      });
    }
  });
}

exports.doLinkSearch = function (filteredQuery, userId, fromIndex, size, daysLimit, callback) {

  var startLinkSearch = Date.now();
  var indexAlias = esUtils.getIndexAliasForUser( userId );
  var searchQuery = searchHelpers.getSearchQuery( filteredQuery, true, userId, fromIndex, size, daysLimit );

  esUtils.search( indexAlias, searchHelpers.INDEX_TYPE, searchQuery, function( err, responseData ) {
    if ( err ) {
      callback(winston.makeError ('Error in link search', {error : err}));

    } else {
      // process the data
      var ids = [];
      var scores = [];

      var endLinkSearch = Date.now();

      winston.doInfo ('Link search elapsed time', {time : (endLinkSearch - startLinkSearch)/1000});

      searchHelpers.extractDataFromHits (responseData, true, ids, scores);

      var startDbPull = Date.now();

      linkHelpers.getLinksById(ids, userId, function (err, links) {
        if (err) {
          callback(err);

        } else {
          var endDbPull = Date.now ();
          winston.doInfo ('Link dbpull elapsed time', {time : (endDbPull - startDbPull)/1000});
          callback(null, links);
        }
      });
    }
  });
}

exports.getMustClauses = function (userId, filters, isLink, daysLimit, isImage) {

  var must = []

  if (typeof isLink != 'undefined') {
    var tq = {
      "term" : {
        "isLink" : isLink
      }
    }
    must.push (tq);
  }

  if ( ! isLink ) {
    var onlyImages = false;
    if ( isImage ) {
      onlyImages = true;
    }
    var tq = {
      "term" : {
        "isImage" : onlyImages
      }
    }
    must.push (tq);
  }

  for (var key in filters) {
    var queryText = filters[key];

    if (key === 'to') {
      var tq = {
        "query_string" : {
          "query" : queryText,
          "fields" : [ "recipientEmailsKey", "recipientEmails", "recipientNames" ],
          "default_operator" : "and"
        }
      }
      must.push (tq);
    }
    else if (key === 'from') {
      var tq = {
        "query_string" : {
          "query" : queryText,
          "fields" : [ "authorEmailKey", "authorEmail", "authorName" ],
          "default_operator" : "and"
        }
      }
      must.push (tq);
    }
    else if (key === 'filename') {
      var tq = { 
        term : {
          "filename" : queryText,
        }
      }
      must.push (tq);
    }
    else if (key === 'before') {
      //TODO
    }
    else if (key === 'after') {
      //TODO
    }
    else if (key === 'recipientOrSender') {

      /*
      var tq = {
        "multi_match" : {
          "query" : queryText,
          "fields" : [ "recipientEmails", "authorEmailKey"]
        }
      }*/

      if (!queryText.indexOf ('@')) {
        winston.doError ('email match didn\'t contain @ symbol');
      } else {

        // TODO: this is a hack b/c recipientEmails is a tokenized field
        // but we want to mimic gmail search. recipientEmailsKey field is not
        // working so this it he next best thing we can do
        var bool = {
          bool : {
            should : [ 
              {
                "match" : {
                  "authorEmailKey" : queryText
                }
              },
              {
                "match" : {
                  "recipientEmails" : queryText.substring (0, queryText.indexOf ('@'))
                }
              }
           ],
           "minimum_should_match" : 1,
          }
        }

        must.push (bool);

      }
    }
  }

  if ( daysLimit ) {
    var currentTime = Date.now();
    var cutoffDate = new Date(currentTime - daysLimit*constants.ONE_DAY_IN_MS);
    var cutoffDateTimestamp = cutoffDate.getTime();
    //winston.doInfo('cutoffDate', {cutoffDate: cutoffDate, cutoffDateTimestamp: cutoffDateTimestamp});
    var tq = {
      range : {
        "date" : {
          "from": cutoffDateTimestamp
        }
      }
    }
    must.push(tq);
  }

  return must;
}


exports.getSearchQuery = function (filteredQuery, isLink, userId, fromIndex, size, daysLimit, isImage) {
  
  var query = searchHelpers.cleanQueryString (filteredQuery.query);
  var must = searchHelpers.getMustClauses (userId, filteredQuery.filters, isLink, daysLimit, isImage);

  var queryStringQuery = {
    "query_string" : {
      "query" : query,
      "fields" : [ 
        "file", 
        "title", 
        "filename", 
        "url", 
        "authorName", 
        "authorEmail", 
        "recipientNames", 
        "recipientEmails", 
        "emailBody", 
        "emailSubject", 
        "docType" 
      ],
      "default_operator" : "and"
    }
  };

  must.push (queryStringQuery)

  if ( ! fromIndex ) {
    fromIndex = 0;
  }

  var queryObj = {
      "fields" : ["isLink"]
    , "size" : size
    , "from" : fromIndex
    , "sort" : {
        "date" : {
          "order" : "desc"
        }
      }
    , "query" : {
        "bool" : {
          "must" : must
        }
      }
  }
  return queryObj;
}

exports.extractDataFromHits = function (parsed, isLink, ids) {
  if (parsed.hits) {
    parsed.hits.hits.forEach(function (hit) {
      if ( hit._id && hit._id !== '' ) {
        ids.push(hit._id);
      }
    });
  }
}

exports.filterGmailSearchQuery = function (query) {
  var decodedQuery = decodeURIComponent(query);  
  var clean = decodedQuery;
  winston.doInfo('decodedQuery', {decodedQuery: decodedQuery});
  var filters = {};

  clean = clean.replace(/\+/g, " ");

  // find regex match of email...
  var emailAddressToken = searchHelpers.getFirstEmailToken (clean);
  if (emailAddressToken) {
    filters.recipientOrSender = emailAddressToken.toLowerCase();
  }

  var toRegex = /to:(?:(".*?")|[\+]*([^\+]+))/;
  var toMatch = decodedQuery.match(toRegex);
  if (toMatch && toMatch.length) {
    var toEmail = toMatch[1] || toMatch[2];
    clean = clean.replace(toRegex, toEmail);
    if (toEmail) {
      // TODO: split on ,
      filters.to = toEmail.replace(","," ").toLowerCase();
    }
  }

  var fromRegex = /from:(?:(".*?")|[\+]*([^\+]+))/;
  var fromMatch = decodedQuery.match(fromRegex);
  if (fromMatch && fromMatch.length) {
    var fromEmail = fromMatch[1] || fromMatch[2];
    clean = clean.replace(fromRegex, fromEmail);
    if (fromEmail) {
      filters.from = fromEmail.replace (",", " ").toLowerCase();
    }
  }

  var filenameRegex = /filename:(?:(".*?")|[\+]*([^\+]+))/;
  var filenameMatch = decodedQuery.match(filenameRegex);
  if (filenameMatch && filenameMatch.length) {
    var filename = filenameMatch[1] || filenameMatch[2];
    clean = clean.replace(filenameRegex, filename);
    filters.filename = filename;
  }

  var hasAttachmentRegex = /has:attachment/;
  if (decodedQuery.match(hasAttachmentRegex)) {
    clean = clean.replace(hasAttachmentRegex, '');
    filters.hasattachment = true;
  }

  var beforeRegex = /before:([0-9]{4}\/([1-9]|0[1-9]|1[012])\/(0[1-9]|[12][0-9]|3[01]|[1-9]))/;
  if (decodedQuery.match(beforeRegex)) {
    filters.before = decodedQuery.match(beforeRegex)[1];
    clean = clean.replace(beforeRegex, '');
  }

  var afterRegex = /after:([0-9]{4}\/([1-9]|0[1-9]|1[012])\/(0[1-9]|[12][0-9]|3[01]|[1-9]))/;
  if (decodedQuery.match(afterRegex)) {
    filters.after = decodedQuery.match(afterRegex)[1];
    clean = clean.replace(afterRegex, '');
  }

  winston.doInfo ('CLEAN QUERY', {clean : clean, filters: filters});

  return {'query' : clean, 'filters' : filters};
}



/*
 * helper function - elastic search query strings cannot contain any of these characters
 * good string to test: what!!+-&&||!(){}[]^*"?~\ */
 
exports.cleanQueryString = function(str) {

    //var chars = {'+': 1, '-': 1, '&&': 1, '||': 1, '!': 1, '(': 1, ')': 1, '{': 1, '}': 1, '[': 1, ']': 1, '^': 1, '"': 1, '~': 1, '*': 1, '?': 1, ':': 1, '\\': 1}
    //better to replace with spaces since these will be ignored by search
    str = str.replace(/[\+\-&\|!\(\)\{\}\[\]\^"~\*\?:\\]/g, " ")

    return str
}


exports.getFirstEmailToken = function (query) {
  var tokens = query.split (" ");

  for (var i = 0; i < tokens.length; i++) {
    if (searchHelpers.validateEmail (tokens[i])) {
      return tokens[i];
    }
  }

}

exports.validateEmail = function (email) { 
  if (!email) {
    return false
  }

  var decodedQuery = decodeURIComponent(email);  

  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(decodedQuery);
}
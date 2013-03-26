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
  , mikeyAPIConstants = require ('../constants');

var searchHelpers = this;


exports.doSearch = function (query, userId, from, size, searchCallback) {

  var filteredQuery = searchHelpers.filterGmailSearchQuery (query);
  var decodedQS = filteredQuery.query;

  /*
  // detect email only matches
  if (searchHelpers.validateEmail (query)) {
    filteredQuery = {
      filters : {
        recipientOrSender : query
      },
      query : query
    }
  }
  */

  winston.info ('filtered', filteredQuery);

  if (filteredQuery.query == "") {
    searchCallback (null, {'attachments' : [], 'links': [], 'images' : []});
    return;
  }

  async.parallel ([
    function (callback) {
      searchHelpers.doAttachmentSearch (filteredQuery, userId, from, size, callback);
    },
    function (callback) {
      searchHelpers.doLinkSearch (filteredQuery, userId, from, size, callback);
    }
  ], function (err, data) {

    if (err) {
      winston.handleError (err);
      searchCallback ('internal error');
    }
    else {
      searchCallback(null, {'attachments' : data[0]['attachments'], 'images': data[0]['images'], 'links': data[1]});

    }

  });

  /*
 
  esConnect.getClient().search(conf.elasticSearch.indexAlias, 'resource', 
    searchHelpers.getSearchQuery (filteredQuery, userId, from, size))
    .on('data', function(data) {
      console.log (data);
      var parsed = JSON.parse(data);

      var linkHashes = [];
      var linkScores = [];

      var attachmentHashes = [];
      var attachmentScores = [];
 
      var allResources = [];

      searchHelpers.extractDataFromHits (parsed, allResources, linkHashes, linkScores, attachmentHashes, attachmentScores);

      async.parallel ([
        function (callback) {
          attachmentHelpers.getAttachmentsByHash(attachmentHashes, userId, attachmentScores, function (err, attachments) {
            if (err) {
              callback(err);
            }
            else{
              callback(null, attachments);
            }
          })
        },
        function (callback) {
          linkHelpers.getLinksByHash(linkHashes, userId, linkScores, function (err, links) {
            if (err) {
              callback(err);
            }
            else {
              callback(null, links);
            }
          })
        }
      ], function (err, data) {

        if (err) {
          winston.doError ("searchHelpers doSearch ", {error: err});
        }

        searchCallback(null, {'attachments' : data[0]['attachments'], 'images': data[0]['images'], 'links': data[1]});

      })

    })
    // elastic search error
    .on('error', function(error) {
      console.error("Error: " + error);
      callback (error);
    })
    .exec()

    */

}


exports.doAttachmentSearch = function (filteredQuery, userId, from, size, callback) {
  esUtils.search (conf.elasticSearch.indexAlias, 'resource', 
    searchHelpers.getSearchQuery (filteredQuery, false, userId, from, size), 
    function (err, responseData) {
      if (err) {
        callback(winston.makeError ('Error in link search', {error : err}));
      }
      else {
        // process the data
        var hashes = [];
        var scores = [];

        searchHelpers.extractDataFromHits (responseData, false, hashes, scores);

        attachmentHelpers.getAttachmentsByHash(hashes, userId, scores, function (err, attachments) {
          if (err) {
            callback(winston.makeMongoError (err));
          }
          else{
            callback(null, attachments);
          }
        });

      }
    });
}

exports.doLinkSearch = function (filteredQuery, userId, from, size, callback) {

  esUtils.search (conf.elasticSearch.indexAlias, 'resource', 
    searchHelpers.getSearchQuery (filteredQuery, true, userId, from, size), 
    function (err, responseData) {
      if (err) {
        callback(winston.makeError ('Error in link search', {error : err}));
      }
      else {

        // process the data
        var hashes = [];
        var scores = [];

        searchHelpers.extractDataFromHits (responseData, true, hashes, scores);


        linkHelpers.getLinksByHash(hashes, userId, scores, function (err, links) {
          if (err) {
            callback(winston.makeMongoError (err));
          }
          else {
            callback(null, links);
          }
        });

      }
    });

}

exports.getMustClauses = function (userId, filters, resourceHashes) {
  console.log (filters)
  var must = [
    {
      "term" : {
        "userId" : {"value" : userId, "boost" : 0.0}
      }
    }
  ]

  for (var key in filters) {
    var queryText = filters[key];

    if (key === 'to') {
      var tq = {
        "multi_match" : {
          "query" : queryText,
          "fields" : [ "recipientEmails", "recipientNames" ]
        }
      }
      must.push (tq);
    }
    else if (key === 'from') {
      var tq = {
        "multi_match" : {
          "query" : queryText,
          "fields" : [ "authorEmail", "authorName" ]
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

    }
    else if (key === 'after') {

    }
    else if (key === 'recipientOrSender') {
      var tq = {
        "multi_match" : {
          "query" : queryText,
          "fields" : [ "recipientEmails", "recipientNames", "authorEmail", "authorName" ]
        }
      }
      must.push (tq);      
    }
  }


  return must;
}


exports.getSearchQuery = function (filteredQuery, isLink, userId, from, size) {
  var query = searchHelpers.cleanQueryString (filteredQuery.query);

  var must = searchHelpers.getMustClauses (userId, filteredQuery.filters)

  var queryObj = {
    "fields": ["isLink"],
    size: size,
    "query": {
      "filtered" : {
        "query" : {
          bool : {
            must : [
              {
                "term" : {
                  "isLink" : {"value" : isLink, "boost" : 0.0}
                }
              }
            ],
            should : [
              {
                queryString: {
                  "fields": ["file", "title"],
                  "query": query
                }
              },  
              {
                queryString: {
                  "fields": ["file", "title"],
                  "query": query,
                  "phrase_slop": 250,
                  "auto_generate_phrase_queries": true,
                  "boost": 2.0
                }
              },
              {
                queryString: {
                  "fields": ["file", "title"],
                  "query": "\"" + query + "\"",
                  "phrase_slop": 150,
                  "auto_generate_phrase_queries": false,
                  "boost": 3.0
                }
              },
              {
                "top_children" : {
                  "type": "resourceMeta",
                  "query": {
                    bool: {
                      must : must,
                      should: [
                        {
                          queryString: {
                            "fields" : ["filename", "url", "authorName", "authorEmail", "recipientNames", "recipientEmails", "emailBody", "emailSubject"],
                            "query": query
                          }
                        }
                      ]
                    }
                  },
                  "score" : "max",
                  "factor" : 10,
                  "incremental_factor" : 2
                }
              }
            ]
          }
        },
        "filter" : {
          "has_child" : {
            "type" : "resourceMeta",
            "query" : {
              bool: {
                must : must
              }
            }
          }
        }
      }
    }
  }

  console.log (util.inspect(queryObj, true, null, true))

  return queryObj
}


exports.getChildSearchQuery = function (filteredQuery, userId, size, allHashes) {
  var query = searchHelpers.cleanQueryString (filteredQuery.query);

  var must = searchHelpers.getMustClauses (userId, filteredQuery.filters, allHashes);

  var queryObj = {
    "fields": ["isLink", "mailId", "_routing"],
    size: size,
    "query": {
      "filtered" : {
        "query" : {
          bool: {
            must : must,
            should: [
              {
                queryString: {
                  "fields" : ["url"],
                  "query": query
                }
              }
            ]
          }
        },
        "filter" : {
          "has_parent" : {
              "parent_type" : "resource",
              "query" : {
                  "terms" : {
                      "_id" : allHashes
                  }
              }
          }          
        }
      }
    }
  }

  console.log (util.inspect(queryObj, true, null, true))

  return queryObj
}


exports.extractDataFromHits = function (parsed, isLink, hashes, scores) {
  if (parsed.hits) {
    var top = true;
    parsed.hits.hits.forEach(function (hit) {

      var minScore = mikeyAPIConstants.SEARCH_THRESHOLD;

      // if no results are "good" enough try to at least get the top result + anything half as good
      // as long as the top result isn't egregiously bad...
      if (top > mikeyAPIConstants.ABSOLUTE_MIN_SCORE) {
        minScore = Math.min (mikeyAPIConstants.SEARCH_THRESHOLD, hit._score/2.0);
        top = false;
      }

      if (hit._score > minScore && hit.fields && !isLink) {
        var hash = hit._id.split ("_")[0];
        var fileSize = hit._id.split ("_")[1];
        hashes.push({hash: hash, fileSize : fileSize});
        scores[hit._id] = hit._score;
      }
      else if (hit._score > mikeyAPIConstants.SEARCH_THRESHOLD) {
        scores[hit._id] = hit._score;
        hashes.push(hit._id);
      }
    })
  }
}

/*
exports.extractDataFromHits = function (parsed, allResources, linkHashes, linkScores, attachmentHashes, attachmentScores) {
  if (parsed.hits) {
    var top = true;
    parsed.hits.hits.forEach(function (hit) {

      allResources.push (hit._id);

      var minScore = mikeyAPIConstants.SEARCH_THRESHOLD;

      // if no results are "good" enough try to at least get the top result + anything half as good
      // as long as the top result isn't egregiously bad...
      if (top > mikeyAPIConstants.ABSOLUTE_MIN_SCORE) {
        minScore = Math.min (mikeyAPIConstants.SEARCH_THRESHOLD, hit._score/2.0);
        top = false;
      }

      if (hit._score > minScore && hit.fields && (hit.fields.isLink == false || hit.fields.isLink == 'false')) {
        var hash = hit._id.split ("_")[0];
        var fileSize = hit._id.split ("_")[1];
        attachmentScores[hit._id] = hit._score;
        attachmentHashes.push({hash: hash, fileSize : fileSize});
      }
      else if (hit._score > mikeyAPIConstants.SEARCH_THRESHOLD) {
        linkScores[hit._id] = hit._score;
        linkHashes.push(hit._id);
      }
    })
  }
}
*/

exports.filterGmailSearchQuery = function (query) {
  var decodedQuery = decodeURIComponent(query);  
  var clean = decodedQuery;
  winston.info ('decodedQuery', decodedQuery);
  var filters = {};

  //TODO: hack
  if (searchHelpers.validateEmail (clean)) {
    filters = {recipientOrSender : clean};
    return {'query' : clean, 'filters' : filters};
  }


  clean = clean.replace("+", " ");

  var toRegex = /to:(?:(".*?")|[\+]*([^\+]+))/;
  var toMatch = decodedQuery.match(toRegex);
  if (toMatch && toMatch.length) {
    var toEmail = toMatch[1] || toMatch[2];
    clean = clean.replace(toRegex, toEmail);
    filters.to = toEmail;
  }

  var fromRegex = /from:(?:(".*?")|[\+]*([^\+]+))/;
  var fromMatch = decodedQuery.match(fromRegex);
  if (fromMatch && fromMatch.length) {
    var fromEmail = fromMatch[1] || fromMatch[2];
    clean = clean.replace(fromRegex, fromEmail);
    filters.from = fromEmail;
  }

  var filenameRegex = /filename:(?:(".*?")|[\+]*([^\+]+))/;
  var filenameMatch = decodedQuery.match(filenameRegex);
  console.log ("filenameMatch", filenameMatch);
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

  winston.info ('CLEAN QUERY', clean);

  return {'query' : clean, 'filters' : filters};
}



/*
 * helper function - elastic search query strings cannot contain any of these characters
 * good string to test: what!!+-&&||!(){}[]^*"?~\
 */
exports.cleanQueryString = function(str) {

    //var chars = {'+': 1, '-': 1, '&&': 1, '||': 1, '!': 1, '(': 1, ')': 1, '{': 1, '}': 1, '[': 1, ']': 1, '^': 1, '"': 1, '~': 1, '*': 1, '?': 1, ':': 1, '\\': 1}
    //better to replace with spaces since these will be ignored by search
    str = str.replace(/[\+\-&\|!\(\)\{\}\[\]\^"~\*\?:\\]/g, " ")

    return str
}


exports.validateEmail = function (email) { 
  if (!email) {
    return false
  }

  var decodedQuery = decodeURIComponent(email);  

  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(decodedQuery);
}
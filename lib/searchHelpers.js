var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , util = require('util')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , elasticSearchClient = require (serverCommon + '/lib/esConnect').client
  , attachmentHelpers = require ('./attachmentHelpers')
  , linkHelpers = require ('./linkHelpers')
  , mikeyAPIConstants = require ('../constants')

var searchHelpers = this;

exports.doSearch = function (query, userId, from, size, searchCallback) {

  var filteredQuery = searchHelpers.filterGmailSearchQuery (query);
  winston.info ('filtered', filteredQuery);

  if (filteredQuery.query == "") {
    searchCallback (null, {'attachments' : [], 'links': [], 'images' : []});
    return;
  }


  elasticSearchClient.search(conf.elasticSearch.indexAlias, 'resource', 
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

      // do a child only search where the parents are in the set of link, attachment hashes
      elasticSearchClient.search(conf.elasticSearch.indexAlias, 'resourceMeta', 
        searchHelpers.getChildSearchQuery (filteredQuery, userId, size*5, allResources))
          .on('data', function (data) {
            console.log (util.inspect (data, false, true, false));

            var parsedMetas = JSON.parse(data);

            if (parsedMetas.hits) {
              var bestMatches = {};
              
              parsedMetas.hits.hits.forEach (function (hit) {
                console.log (hit.fields._routing)
                if (!(hit.fields._routing in bestMatches) && hit._score > 0) {
                  bestMatches [hit.fields._routing] = hit._id
                }
              })

              console.log (bestMatches);
            }
          })
          .on ('error', function (err) {

          })
          .exec()

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
  }


  return must;
}


exports.getSearchQuery = function (filteredQuery, userId, from, size) {
  var query = searchHelpers.cleanQueryString (filteredQuery.query);

  var must = searchHelpers.getMustClauses (userId, filteredQuery.filters)

  var queryObj = {
    "fields": ["isLink"],
    size: size,
    "query": {
      "filtered" : {
        "query" : {
          bool : {
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
                            "query": query
                          }
                        }
                      ]
                    }
                  },
                  "score" : "max",
                  "factor" : 5,
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

exports.extractDataFromHits = function (parsed, allResources, linkHashes, linkScores, attachmentHashes, attachmentScores) {
  if (parsed.hits) {
    parsed.hits.hits.forEach(function (hit) {

      allResources.push (hit._id);

      if (hit._score > mikeyAPIConstants.SEARCH_THRESHOLD && hit.fields && (hit.fields.isLink == false || hit.fields.isLink == 'false')) {
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

exports.filterGmailSearchQuery = function (query) {
  var decodedQuery = decodeURIComponent(query);  
  var clean = decodedQuery;
  winston.info ('decodedQuery', decodedQuery);
  var filters = {};
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
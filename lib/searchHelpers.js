var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , elasticSearchClient = require (serverCommon + '/lib/esConnect').client

var searchHelpers = this;

exports.doSearch = function (query, userId, from, size, callback) {

  console.log ('userid', userId)

  elasticSearchClient.search(conf.elasticSearch.indexName, 'resource', searchHelpers.getSearchQuery (query, userId, from, size))
    .on('data', function(data) {

      console.log (data)
      var parsed = JSON.parse(data)
      var linkHashes = []
      var attachmentHashes = []
      var scores = []
 
      if (parsed.hits) {
        var THRESHOLD = 0.0
        parsed.hits.hits.forEach(function (hit) {
          if (hit._score > THRESHOLD && hit.fields && hit.fields.isLink == false) {
            scores[hit._id] = hit._score
            attachmentIds.push(hit._id)
          }
          else if (hit._score > THRESHOLD) {
            scores[hit._id] = hit._score
            linkIds.push(hit._id)            
          }
        })
      }

      //callback (null, hitIds)
      async.parallel ([
        function (callback) {
          attachmentHelper.getAttachmentsForUser(attachmentHashes, userId, function (err, attachments) {
            if (err) {
              callback(err)
            }
            else{
              callback(null, attachments)
            }
          })
        },
        function (callback) {
          linkHelper.getLinksForUser(linkHashes, userId, function (err, links) {
            if (err) {
              callback(err)
            }
            else {
              callback(null, links)
            }
          })
        }
      ], function (err, data) {

        if (err) {
          console.error ("Error: routeSearch: searchFullText ", err)
        }

        res.send({'attachments' : data[0], 'links': data[1]}, 200)

      })
      resourceHelpers.

    })
    // elastic search error
    .on('error', function(error) {
      console.error("Error: " + error)
      callback (error)
    })
    .exec()

}


exports.getSearchQuery = function (query, userId, from, size) {
  var queryObj = {
    "fields": ["isLink"],
    size: size,
    "query" : {
      bool : {
        must : [
          {
            "has_child" : {
              "type" : "resourceMeta",
              "query" : {
                "term" : {
                  "userId" : userId
                }
              }
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
    }
  }

  return queryObj
}
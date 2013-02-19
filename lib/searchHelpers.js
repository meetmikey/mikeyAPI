var serverCommon = process.env.SERVER_COMMON;

var conf = require(serverCommon + '/conf')
  , async = require('async')
  , utils = require(serverCommon + '/lib/utils')
  , AttachmentModel = require(serverCommon + '/schema/attachment').AttachmentModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , elasticSearchClient = require (serverCommon + '/lib/esConnect').client
  , attachmentHelpers = require ('./attachmentHelpers')
  , linkHelpers = require ('./linkHelpers')

var searchHelpers = this;

exports.doSearch = function (query, userId, from, size, searchCallback) {

  console.log ('userid', userId)

  elasticSearchClient.search(conf.elasticSearch.indexName, 'resource', searchHelpers.getSearchQuery (query, userId, from, size))
    .on('data', function(data) {

      console.log (data)
      var parsed = JSON.parse(data)

      var linkHashes = []
      var linkScores = []

      var attachmentHashes = []
      var attachmentScores = []
 
      if (parsed.hits) {
        parsed.hits.hits.forEach(function (hit) {
          if (hit._score > constants.SEARCH_THRESHOLD && hit.fields && hit.fields.isLink == false) {
            var hash = hit._id.split ("_")[0]
            var fileSize = hit._id.split ("_")[1]
            attachmentScores[String(hit._id)] = hit._score
            attachmentHashes.push({hash: hash, fileSize : fileSize})
          }
          else if (hit._score > constants.SEARCH_THRESHOLD) {
            linkScores[hit._id] = hit._score
            linkHashes.push(hit._id)            
          }
        })
      }

      //callback (null, hitIds)
      async.parallel ([
        function (callback) {
          attachmentHelpers.getAttachmentsByHash(attachmentHashes, userId, attachmentScores, function (err, attachments) {
            if (err) {
              callback(err)
            }
            else{
              callback(null, attachments)
            }
          })
        },
        function (callback) {
          linkHelpers.getLinksByHash(linkHashes, userId, linkScores, function (err, links) {
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
          winston.doError ("searchHelpers doSearch ", {error: err})
        }

        searchCallback(null, {'attachments' : data[0], 'links': data[1]})

      })

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
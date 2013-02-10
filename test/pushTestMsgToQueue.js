var constants = require('./constants'),
    sqsConnect        = require(constants.SERVER_COMMON + '/lib/sqsConnect'),
    fs = require ('fs'),
    mongoose = require(constants.SERVER_COMMON + '/lib/mongooseConnect').mongoose

var UserModel = mongoose.model ('User')
/*
var user = {
  "locale" : "en",
  "refreshToken" : "1/Ao8SlC6DvbOPjRHehKGiJSy4AejvQ1k2rX1eVYg5nC4",
  "googleID" : "106939156771784101693",
  "accessToken" : "ya29.AHES6ZSLcem8XTvn4JtZXB7J6bjle8Mnh97OvcijBH3NOA",
  "displayName" : "Sagar Mehta",
  "firstName" : "Sagar",
  "lastName" : "Mehta",
  "email" : "sagar@magicnotebook.com",
  "_id" : "5112eb3e8a9492ee38000004",
  "timestamp" : "2013-02-06T23:46:06.377Z",
  "linksExtracted" : false,
  "attachmentsExtracted" : false,
  "gmailScrapeRequested" : false,
  "__v" : 0
}
*/

var user = {"__v":0,"locale":"en","refreshToken":"1/9x7mwZRpFbJ2GFF14aNSavyxaW6EgLv3fXKuLy9-q2s","googleID":"115882407960585095714","accessToken":"ya29.AHES6ZTZ7QLpyKbfKAXg-anCq6ymWKxGOTHcUX0idv5vmTUh7dU7Jw","displayName":"Sagar Mehta","firstName":"Sagar","lastName":"Mehta","email":"sagar@mikeyteam.com","_id":"5113108d9f2459d70c000004","timestamp":"2013-02-07T02:25:17.361Z","linksExtracted":false,"attachmentsExtracted":false,"gmailScrapeRequested":false}


sqsConnect.addMessageToMailDownloadQueue (user, function (err, msg) {
  if (err) {
    winston.error ('Could not add message to start downloading user data', user._id)
  }
})
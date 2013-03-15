var constants = require('../constants'),
    sqsConnect        = require(constants.SERVER_COMMON + '/lib/sqsConnect'),
    fs = require ('fs'),
    mongoose = require(constants.SERVER_COMMON + '/lib/mongooseConnect').mongoose

var UserModel = mongoose.model ('User')


var user = {
  "googleID" : "115882407960585095714",
  "accessToken" : "ya29.AHES6ZTv6mSGkwsWpxgP-je_-bzFIRhrR5Hwn8jirmxEiPNch3XacA",
  "displayName" : "Sagar Mehta",
  "firstName" : "Sagar",
  "lastName" : "Mehta",
  "email" : "sagar@mikeyteam.com",
  "refreshToken" : "1/om8yXo32__hN15qHV7auZo8pH_j0yFd_Ss0S6vkMOAQ",
  "locale" : "en",
  "hostedDomain" : "mikeyteam.com",
  "expiresAt" : "2013-03-15T19:22:11.887Z",
  "_id" : "514366d3ac0c2dba43000005",
  "timestamp" : "2013-03-15T18:22:11.889Z",
  "gmailScrapeRequested" : true,
  "__v" : 0
}



sqsConnect.addMessageToMailDownloadQueue (user, function (err, msg) {
  if (err) {
    winston.error ('Could not add message to start downloading user data', user._id)
  }
})

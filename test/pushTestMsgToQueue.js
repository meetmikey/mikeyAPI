var constants = require('../constants'),
    sqsConnect        = require(constants.SERVER_COMMON + '/lib/sqsConnect'),
    fs = require ('fs'),
    mongoose = require(constants.SERVER_COMMON + '/lib/mongooseConnect').mongoose

var UserModel = mongoose.model ('User')
var ActiveConnectionModel = mongoose.model ('ActiveConnection')
/*
var user = {
  googleID: "106939156771784101693",
  accessToken: "ya29.AHES6ZTRzRuY0qy5UR0THtDRhLVxDqJqUBgBPmbmglQ",
  displayName: "Sagar Mehta",
  firstName: "Sagar",
  lastName: "Mehta",
  email: "sagar@magicnotebook.com",
  refreshToken: "1/foOYDyaQOkcgALX5KIMidX3REOScB0lr-yB-F5UzRdM",
  locale: "en",
  hostedDomain: "magicnotebook.com",
  _id: "5119c7b60746d47552000005",
  timestamp: "2013-02-12T04:40:22.386Z",
  gmailScrapeRequested: false,
  __v: 0
}
*/
/*
var user = {"__v":0,"googleID":"102110918656901976675","accessToken":"ya29.AHES6ZSBEdLKxZVw1Rq8_Oxr78PnkY9MNvz5QwbAQqXu_DkR0fFyEQ","displayName":"Sagar Mehta","firstName":"Sagar","lastName":"Mehta","email":"svmknicks33@gmail.com","refreshToken":"1/io7ydNijBKUl2iMxVJ1ti5D4vzFseWwLOfdbC1Awq_A","gender":"male","locale":"en","_id":"511854db5b47a4bf14000004","timestamp":"2013-02-11T02:18:03.548Z","gmailScrapeRequested":false}
*/

var user = {"__v":0,"locale":"en","refreshToken":"1/9x7mwZRpFbJ2GFF14aNSavyxaW6EgLv3fXKuLy9-q2s","googleID":"115882407960585095714","accessToken":"ya29.AHES6ZTZ7QLpyKbfKAXg-anCq6ymWKxGOTHcUX0idv5vmTUh7dU7Jw","displayName":"Sagar Mehta","firstName":"Sagar","lastName":"Mehta","email":"sagar@mikeyteam.com","_id":"5113108d9f2459d70c000004","timestamp":"2013-02-07T02:25:17.361Z","linksExtracted":false,"attachmentsExtracted":false,"gmailScrapeRequested":false}


sqsConnect.addMessageToMailDownloadQueue (user, function (err, msg) {
  if (err) {
    winston.error ('Could not add message to start downloading user data', user._id)
  }
})
/*

var connection = new ActiveConnectionModel ({
  userId : user._id
})

connection.save (function (err) {

  if (err) { console.log (err); return;}

  sqsConnect.addMessageToMailUpdateQueue (user, function (err, msg){
    if (err) {
      winston.error ('Could not add message to start downloading user data', user._id)
    }

    console.log (msg)
  })


})*/

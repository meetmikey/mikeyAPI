var serverCommon = process.env.SERVER_COMMON;

var constants = require('../constants'),
    sqsConnect        = require(serverCommon + '/lib/sqsConnect'),
    fs = require ('fs'),
    mongoose = require(serverCommon + '/lib/mongooseConnect').mongoose,
    winston = require(serverCommon + '/lib/winstonWrapper').winston,
    ActiveConnectionModel = require(serverCommon + '/schema/active').ActiveConnectionModel

var UserModel = mongoose.model ('User')
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

var user = {
  "__v":0,
  "locale":"en",
  "refreshToken":"1/9x7mwZRpFbJ2GFF14aNSavyxaW6EgLv3fXKuLy9-q2s",
  "googleID":"115882407960585095714",
  "accessToken":"ya29.AHES6ZTZ7QLpyKbfKAXg-anCq6ymWKxGOTHcUX0idv5vmTUh7dU7Jw",
  "displayName":"Sagar Mehta",
  "firstName":"Sagar",
  "lastName":"Mehta",
  "email":"sagar@mikeyteam.com",
  "_id":"51286e73c99dfd9f11000004",
  "timestamp":"2013-02-07T02:25:17.361Z",
  "linksExtracted":false,
  "attachmentsExtracted":false,
  "gmailScrapeRequested":false
}


var connection = new ActiveConnectionModel ({
  _id : user._id
})

connection.save (function (err) {

  if (err) {
    winston.doError('error', {err: err});
    return;
  }

  sqsConnect.addMessageToMailActiveConnectionQueue (user, function (err, msg){
    if (err) {
      winston.doError('Could not add message to start downloading user data', {userId: user._id});
    }
    winston.doInfo('message', {message: msg});
  })


})
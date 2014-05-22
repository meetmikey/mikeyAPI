var serverCommon = process.env.SERVER_COMMON;
var constants = require ('../constants'),
    mongoose = require(serverCommon + '/lib/mongooseConnect').mongoose

var UserModel = mongoose.model ('User')

var userInfo = new UserModel ({
  "__v" : 0,
  "_id" : "51d713a0e992bcdf6100beb5",
  "accessHash" : "4739bc0728b9b0234f616cb37e1b9de791d889b48d66804f544214e99d3ff5f86c6e16b75a5fc20146299e149b122c27cac38ab60a69e517b2dc101c4eea5d6a",
  "asymHash" : "$2a$08$GDs1mYGLN/xL7KKXkixHReHLp7764.iJxyBVcMjagfwKMoKE8Fjnq",
  "asymSalt" : "$2a$08$GDs1mYGLN/xL7KKXkixHRe",
  "daysLimit" : 90,
  "displayName" : "Jürgen Tanghe",
  "email" : "jurgentanghe@gmail.com",
  "expiresAt" : "2013-07-05T19:42:40.198Z",
  "firstName" : "Jürgen",
  "gender" : "male",
  "gmailScrapeRequested" : true,
  "googleID" : "110668423215370558796",
  "invalidToken" : false,
  "isPremium" : false,
  "lastName" : "Tanghe",
  "locale" : "nl",
  "minMRProcessedDate" : "2013-04-13T22:58:54Z",
  "minMailDate" : "2006-06-28T15:26:39Z",
  "minProcessedDate" : "2013-04-13T22:58:54Z",
  "picture" : "https://lh5.googleusercontent.com/-JQO0ZMuQWh0/AAAAAAAAAAI/AAAAAAAACsA/5DEjKnlq1xA/photo.jpg",
  "shortId" : "bi",
  "symHash" : "71dc95db62094273513ec99a5366d52bb0dc290166f51011ad5e301d2a7d280c94be880bad1ef73a55b70469527e9d8ba05706113cf6f0b6f5e38b2cc4b377c9",
  "symSalt" : "8f9a072ab4803ccf",
  "timestamp" : "2013-07-05T18:42:40.234Z"
})

console.log (Date.now())
console.log (userInfo.minMRProcessedDate.getTime())
console.log (Date.now() - userInfo.minMRProcessedDate.getTime())

console.log (userInfo.daysLimit*60*60*24*1000)
var ratio = (userInfo.timestamp.getTime() - userInfo.minMRProcessedDate.getTime())/(userInfo.daysLimit*60*60*24*1000)

console.log (ratio)
var serverCommon = process.env.SERVER_COMMON;

var constants = require('../constants'),
    sqsConnect = require(serverCommon + '/lib/sqsConnect'),
    mongoose = require(serverCommon + '/lib/mongooseConnect').mongoose,
    winston = require (serverCommon + '/lib/winstonWrapper').winston

var UserModel = mongoose.model ('User')

exports.addGmailScrapingJob = function (user) {

  //push the user onto the queue
  if (!user.gmailScrapeRequested) {
    sqsConnect.addMessageToMailDownloadQueue (user, function (err, msg) {
      if (err) {
        winston.doError ('Could not add message to start downloading user data', {user : user});
      }
      else {
        UserModel.update ({_id : user._id},
          {$set : {gmailScrapeRequested : true}},
          function (err, numAffected) {

            if (err) {
              winston.doMongoError ('Mongo error attempting to update user gmailScrapeRequested state', {userId : user._id});
            }
            else if (numAffected == 0) {
              winston.doMongoError ('Mongo error: zero records affected updating user gmailScrapeRequested state', {userId : user._id});
            }
            else {
              winston.info ('updated gmailScrapeRequested state');
            }

          })
      }
    })
  }

}
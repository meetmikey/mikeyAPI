var constants = require('../constants'),
    sqsConnect = require(constants.SERVER_COMMON + '/lib/sqsConnect'),
    mongoose = require(constants.SERVER_COMMON + '/lib/mongooseConnect').mongoose

var UserModel = mongoose.model ('User')

exports.addGmailScrapingJob = function (user) {

  //push the user onto the queue
  if (!user.gmailScrapeRequested) {
    sqsConnect.addMessageToMailDownloadQueue (user, function (err, msg) {
      if (err) {
        //TODO: retry?
        winston.error ('Could not add message to start downloading user data', user._id)
      }
      else {
        UserModel.update ({_id : user._id}, 
          {$set : {gmailScrapeRequested : true}},
          function (err, numAffected) {

            if (err) {
              //TODO
            }
            else if (numAffected == 0) {
              //TODO
            }
            else {
              //TODO
            }

          })
      }
    })
  }

}
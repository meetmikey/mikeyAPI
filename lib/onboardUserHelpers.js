var serverCommon = process.env.SERVER_COMMON;

var constants = require('../constants'),
    sqsConnect = require(serverCommon + '/lib/sqsConnect'),
    mongoose = require(serverCommon + '/lib/mongooseConnect').mongoose,
    esUtils = require (serverCommon + '/lib/esUtils'),
    winston = require (serverCommon + '/lib/winstonWrapper').winston;

var UserModel = mongoose.model ('User');
var UserOnboardingStateModel = mongoose.model ('UserOnboardingState');

exports.addGmailScrapingJob = function (user, callback) {

  //push the user onto the queue
  sqsConnect.addMessageToMailDownloadQueue (user, function (err, msg) {
    if (err) {
      winston.doError ('Could not add message to start downloading user data', {user : user});
      callback (err);
    }
    else {
      callback ();

      // there really isn't harm in double queueing the "onboarding" queue job so
      // callback right away even if flag hasn't been set in DB
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
            winston.doInfo ('updated gmailScrapeRequested state');
          }

        });
    }
  });

}

exports.createIndexAlias = function (user, callback) {
  esUtils.createAliasForUser (user._id, callback); 
}


exports.checkUserOnboardingState = function (user, callback) {
  var onboardComplete = false;

  UserOnboardingStateModel.findOne ({userId : user._id}, function (err, foundState) {
    if (err) {
      callback (winston.makeMongoError (err));
    } else if (!foundState || (foundState && foundState.lastCompleted !== 'markStoppingPoint')) {
      winston.doWarn ('User onboarding state is not completed', {userId : user._id});
      callback (null, onboardComplete);
    } else {
      winston.doInfo ('User onboarding state is completed', {userId : foundState.userId});
      onboardComplete = true;
      callback (null, onboardComplete);
    }
  });
}
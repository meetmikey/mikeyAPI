var serverCommon = process.env.SERVER_COMMON;

var winston = require(serverCommon + '/lib/winstonWrapper').winston
  , appInitUtils = require(serverCommon + '/lib/appInitUtils')
  , mongoose = require(serverCommon + '/lib/mongooseConnect').mongoose
  , async = require('async')

var userId = '5180a4a29a947a7515000009';
var UserOnboardingStateModel = mongoose.model ('UserOnboardingState');

var initActions = [
  appInitUtils.CONNECT_MONGO
];

appInitUtils.initApp( 'testTimeComparison', initActions, null, function() {

  UserOnboardingStateModel.findOne ({userId : userId}, 
    '_id userId lastCompleted mikeyMailTS',
    function (err, foundState) {
      if (err) {
        winston.doMongoError(err, null, res);
      }
      else if (foundState) {
        if (foundState.lastCompleted != 'markStoppingPoint') {
          winston.doInfo('progress 0');
        }
        else {
          var dateCalc = new Date(Date.now () - 60*1000*60*12;
          winston.doInfo('here', {mikeyMailTS: foundState.mikeyMailTS, dateCalc: dateCalc});

          // check if it's been > 24 hours since onboarding complete
          if (foundState.mikeyMailTS < dateCalc)) {
            winston.doInfo ('12 hours since onboarding, pretty sure we\'re done');
            winston.doInfo('progress 1');
          }
        }
      }
    })
})
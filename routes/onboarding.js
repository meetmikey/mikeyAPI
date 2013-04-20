var serverCommon = process.env.SERVER_COMMON;

var winston = require(serverCommon + '/lib/winstonWrapper').winston,
    constants = require ('../constants'),
    UserOnboardingStateModel = require (serverCommon  + '/schema/onboard').UserOnboardingStateModel,
    MailModel = require (serverCommon + '/schema/mail').MailModel;

exports.getOnboardingState = function (req, res) {
  
  var userId = req.user._id;

  UserOnboardingStateModel.findOne ({userId : userId}, 
    '_id userId lastCompleted mikeyMailTS',
    function (err, foundState) {
      if (err) {
        winston.doMongoError(err, null, res);
      }
      else if (foundState) {
        if (foundState.lastCompleted != 'markStoppingPoint') {
          res.send ({'progress' : 0});
        }
        else {
          // check if it's been > 24 hours since onboarding complete
          if (foundState.mikeyMailTS < new Date(Date.now () - 60*1000*60*24)) {
            winston.doInfo ('24 hours since onboarding, pretty sure we\'re done');
            res.send ({'progress' : 1});
          } else {
            // check whether 75% of mails with mmDone=true are also mailReaderState = done
            MailModel.count ({userId : userId, mmDone : true}, function (err, mmDoneCount) {
              if (err) {
                winston.doMongoError (err, {'err' : 'mongo error'}, res);
              } else {
                MailModel.count ({userId: userId, mmDone : true, mailReaderState : 'done'}, function (err, readerDoneCount) {
                  if (err) {
                    winston.doMongoError (err, {'err' : 'mongo error'}, res);
                  } else if (readerDoneCount/mmDoneCount > constants.DONE_THRESHOLD) {
                    res.send ({'progress' : 1});
                  } else {
                    winston.doInfo ('Progress of onboarding not high enough', {progress : readerDoneCount/mmDoneCount});
                    res.send ({'progress' : 0});
                  }
                });
              }
            });
          }
        }
      }
      else {
        res.send ({'progress' : 0});
      }
    });

};
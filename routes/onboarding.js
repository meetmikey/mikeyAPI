var serverCommon = process.env.SERVER_COMMON;

var winston         = require(serverCommon + '/lib/winstonWrapper').winston,
    mongoose        = require(serverCommon + '/lib/mongooseConnect').mongoose
    UserOnboardingStateModel = require (serverCommon  + '/schema/onboard').UserOnboardingStateModel;

exports.getOnboardingState = function (req, res) {
  
  var userId = req.user._id;
  var linkId = req.params.linkId;

  UserOnboardingStateModel.findOne ({userId : userId}, '_id userId lastCompleted',
    function (err, foundState) {
      if (err) {
        winston.doMongoError (err, res)
      }
      else if (foundState) {
        if (foundState.lastCompleted != 'markStoppingPoint') {
          res.send ({'progress' : 0});
        }
        else {
          res.send ({'progress' : 1});
        }
      }
      else {
        res.send ({'progress' : 0});
      }
    });
}
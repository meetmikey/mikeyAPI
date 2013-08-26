var serverCommon = process.env.SERVER_COMMON;

var winston = require(serverCommon + '/lib/winstonWrapper').winston
  , constants = require ('../constants')
  , mongoose = require(serverCommon + '/lib/mongooseConnect').mongoose
  , upgradeUtils = require(serverCommon + '/lib/upgradeUtils')
  , sesUtils = require(serverCommon + '/lib/sesUtils')

var routeUser = this;
var UserModel = mongoose.model ('User')

exports.getCurrentUser = function (req, res) {
  var userEmail = req.query.userEmail;
  var asymHash = req.query.asymHash;

  if (!req.query.asymHash) {
    res.send ({"error" : "client needs to upgrade extension"}, 400);
    return;
  }

  var query = {
    email : userEmail,
    asymHash : asymHash
  };

  UserModel.findOne (query,
    constants.DEFAULT_USER_FIELDS,
    function (err, foundUser) {
      if (err) {
        res.send ({"error" :  "internal error"}, 500);
      }
      else if (!foundUser) {
        res.send ({"error" : "invalid credentials"}, 401);
      }
      else {
        res.send (foundUser);
      }
    });

}

exports.requestAccountDelete = function (req, res) {
  var userEmail = req.body.userEmail;
  var asymHash = req.body.asymHash;

  var query = {
    email : userEmail,
    asymHash : asymHash
  };

  UserModel.update (query,
    {$set : {deleteRequest : true}},
    function (err, num) {
      if (err) {
        res.send ({"error" :  "internal error"}, 500);
      }
      else if (num === 0) {
        res.send ({"error" : "invalid credentials"}, 401);
      }
      else {
        // send internal notification to delete account
        var text = 'Account delete requested by user ' + userEmail;
        var subject = text;
        sesUtils.sendEmail(['support@mikeyteam.com'], 'noreply@mikeyteam.com', text, text, subject, function (err) {
          if (err) {
            winston.doMongoError(err, null, res);
          } else {
            res.send (200);
          }
        });
      }
    });
}

exports.upgradeInterest = function( req, res ) {
  var userEmail = req.query.userEmail;

  var text = '';
  if ( userEmail ) {
    text += userEmail;
  } else {
    text += 'an unknown user';
  }
  text += ' clicked upgrade';
  var subject = 'user clicked upgrade';

  sesUtils.sendInternalNotificationEmail(text, subject, function(err) {
    if ( err ) {
      winston.handleError(err);
    }
  });
  res.send(200);
}

exports.upgradeUserToBillingPlan = function( req, res ) {

  var stripeCardToken = req.body.stripeCardToken;
  var billingPlan = req.body.billingPlan;
  var userEmail = req.body.userEmail;

  upgradeUtils.tryOrCreateUpgradeJob( userEmail, stripeCardToken, billingPlan, function(err) {
    if ( err ) {
      winston.handleError(err);
      res.send(400);

      //bad. send email...
      var text = 'userEmail: ' + userEmail + ', billingPlan: ' + billingPlan + ', error: ' + err.log;
      var subject = 'BAD: upgradeUserToBillingPlan route returned error';
      sesUtils.sendInternalNotificationEmail( text, subject, function(err) {
        if ( err ) {
          winston.handleError(err);
        }
      });

    } else {
      res.send(200);
    }
  });
}

exports.cancelUserBillingPlan = function( req, res ) {

  var userEmail = req.body.userEmail;

  upgradeUtils.tryOrCreateCancelUserBillingPlanJob( userEmail, function(err) {
    if ( err ) {
      winston.handleError(err);
      res.send(400);

      //bad. send email...
      var text = 'userEmail: ' + userEmail + ', error: ' + err.log;
      var subject = 'BAD: cancelUserBillingPlan route returned error';
      sesUtils.sendInternalNotificationEmail( text, subject, function(err) {
        if ( err ) {
          winston.handleError(err);
        }
      });

    } else {
      res.send(200);
    }
  });
}


//DEPRECATED, slated for removal when everyone's upgraded to use only the '/creditPromotionAction' route.
exports.creditChromeStoreReview = function( req, res ) {

  var user = req.user;
  var userEmail = user.email;
  var promotionType = 'chromeStoreReview';

  upgradeUtils.creditPromotionAction( user, promotionType, function(err) {
    if ( err ) {
      winston.handleError(err);
      res.send(400);

      //bad. send email...
      var text = 'userEmail: ' + userEmail + ', error: ' + err.log;
      var subject = 'BAD: creditChromeStoreReview route returned error';
      sesUtils.sendInternalNotificationEmail( text, subject, function(err) {
        if ( err ) {
          winston.handleError(err);
        }
      });

    } else {
      res.send(200);
    }
  });
}

exports.creditPromotionAction = function( req, res ) {

  var user = req.user;
  var userEmail = user.email;
  var promotionType = req.body.promotionType;

  upgradeUtils.creditPromotionAction( user, promotionType, function(err) {
    if ( err ) {
      winston.handleError(err);
      res.send(400);

      //bad. send email...
      var text = 'userEmail: ' + userEmail + ', error: ' + err.log;
      var subject = 'BAD: creditPromotionAction route returned error, promotionType: ' + promotionType + ', userEmail: ' + userEmail;
      sesUtils.sendInternalNotificationEmail( text, subject, function(err) {
        if ( err ) {
          winston.handleError(err);
        }
      });

    } else {
      res.send(200);
    }
  });
}
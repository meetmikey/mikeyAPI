var serverCommon = process.env.SERVER_COMMON;

var winston = require(serverCommon + '/lib/winstonWrapper').winston
  , referralUtils = require(serverCommon + '/lib/referralUtils')
  , mikeyAPIConstants = require ('../constants')
  , constants = require (serverCommon + '/constants')
  , conf = require (serverCommon + '/conf')
  , url = require ('url')
  , UserOnboardingStateModel = require (serverCommon  + '/schema/onboard').UserOnboardingStateModel
  , UserModel = require (serverCommon  + '/schema/user').UserModel
  , MailModel = require (serverCommon + '/schema/mail').MailModel
  , mikeyAPIConf = require('../conf')

var routeOnboarding = this;

exports.getOnboardingState = function (req, res) {
  
  var userId = req.user._id;
  var userInfo = req.user;

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
          // check if it's been > 8 hours since onboarding complete
          if (foundState.mikeyMailTS < new Date(Date.now () - 60*1000*60*24)) {
            winston.doInfo ('24 hours since onboarding, pretty sure we\'re done', {userId: userId});
            res.send ({'progress' : 1});
          } else {

            var ratio = (userInfo.timestamp.getTime() - userInfo.minMRProcessedDate.getTime())/(userInfo.daysLimit*constants.ONE_DAY_IN_MS)

            // base case
            if (ratio > .75) {
              res.send ({progress : 1});
            } 
            // maybe the user doesn't have a lot of mail in account
            else if ((userInfo.minMRProcessedDate.getTime()-userInfo.minMailDate.getTime())/constants.ONE_DAY_IN_MS < 3) {
              res.send ({progress : 1});
            } 
            else {
              winston.doInfo ('Progress of onboarding not high enough', {progress : ratio});
              res.send ({'progress' : 0});
            }

          }
        }
      }
      else {
        res.send ({'progress' : 0});
      }
    });

};

exports.moveDomain = function ( req, res, next ) {

  if (req.headers.host !== conf.domain) {
    winston.doInfo ('redirect');
    res.redirect ('https://' + conf.domain + '/' + req.params.rId + '/' + req.params.source);
  } else {
    winston.doInfo ('no redirect');
    next();
  }
}

exports.installRedirect = function( req, res ) {

  var referralId = req.params.rId;
  var source = req.params.source;

  var originURL = req.header('Referer');
  winston.doInfo('installRedirect', {referralId: referralId, source: source, originURL: originURL, reqHeaders: req.headers});

  if ( referralId ) {
    res.cookie('referralId', referralId, { maxAge: mikeyAPIConstants.REFERRAL_COOKIE_MAX_AGE, httpOnly: false, signed: true });
    if ( source ) {
      res.cookie('source', source, { maxAge: mikeyAPIConstants.REFERRAL_COOKIE_MAX_AGE, httpOnly: false, signed: true });
    } else {
      winston.doWarn('routeOnboarding: installRedirect: referralId, but no source');
    }
    if ( originURL ) {
      res.cookie('originURL', originURL, { maxAge: mikeyAPIConstants.REFERRAL_COOKIE_MAX_AGE, httpOnly: false, signed: true });
    }
  } else {
    winston.doWarn('routeOnboarding: installRedirect: no referralId');
  } 

  res.redirect( mikeyAPIConf.installURL );
}

exports.checkForReferral = function( req, res ) {
  if ( req && req.signedCookies && req.signedCookies['referralId'] ) {
    var newUser = req.user;
    var referralId = req.signedCookies['referralId'];
    // get the userId
    UserModel.findOne ({shortId : referralId}, function (err, refUser) {
      if (err) {
        winston.doMongoError(err);

      } else if ( ! refUser ) {
        winston.doError('no oldUser');

      } else if ( refUser._id == newUser._id ) {
        winston.doWarn('routeOnboarding: checkForReferral: Old user is the same as new user.  Not saving referral.', {oldUserId: refUser._id, newUserId: newUser._id});

      } else {
        var source = null;
        if ( req.signedCookies['source'] ) {
          source = req.signedCookies['source'];
        }
        var originURL = null;
        if ( req.signedCookies['originURL'] ) {
          originURL = req.signedCookies['originURL'];
        }

        //winston.doInfo('checkForReferral', {referralId: referralId, source: source, newUser: newUser});
        if ( newUser && referralId ) {
          var newUserId = newUser._id;
          referralUtils.saveReferral( refUser._id, newUserId, source, originURL, function(err) {
            if ( err ) {
              winston.handleError(err);
            }
          });
        } else {
          winston.doError('onboarding: checkForReferral: no newUserId!', {referralId: referralId, source: source});
        }
      }
    });

  } else {
    winston.doInfo('onboarding: checkForReferral: no referralId');
  }

  if ( res ) {
    res.send(200);
  }
}

exports.testReferral = function(req, res) {
  var referralId = req.signedCookies['referralId'];
  var source = req.signedCookies['source'];
  var message = 'testReferral, referralId: ' + referralId + ', source: ' + source;
  console.log( message );
  res.send(200, message);
}
var serverCommon = process.env.SERVER_COMMON;

var winston = require(serverCommon + '/lib/winstonWrapper').winston
  , referralUtils = require(serverCommon + '/lib/referralUtils')
  , mikeyAPIConstants = require ('../constants')
  , UserOnboardingStateModel = require (serverCommon  + '/schema/onboard').UserOnboardingStateModel
  , MailModel = require (serverCommon + '/schema/mail').MailModel
  , mikeyAPIConf = require('../conf')

var routeOnboarding = this;

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
                  } else if (readerDoneCount/mmDoneCount > mikeyAPIConstants.DONE_THRESHOLD) {
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

exports.installRedirect = function( req, res ) {

  var referralId = req.query.rId;
  var source = req.query.s;
  var originURL = req.header('Referer');
  //winston.doInfo('installRedirect', {referralId: referralId, source: source, originURL: originURL, reqHeaders: req.headers});

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
      referralUtils.saveReferral( referralId, newUserId, source, originURL, function(err) {
        if ( err ) {
          winston.handleError(err);
        }
        //done.
      });
    } else {
      winston.doError('onboarding: checkForReferral: no newUserId!', {referralId: referralId, source: source});
    }
  } else {
    winston.doInfo('onboarding: checkForReferral: no referralId');
  }
  if ( res ) {
    res.send(200);
  }
}

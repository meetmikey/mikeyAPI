var serverCommon = process.env.SERVER_COMMON;

var passport        = require('passport'),
    GoogleStrategy  = require('passport-google-oauth').OAuth2Strategy,
    bcrypt          = require('bcrypt'),
    conf            = require(serverCommon + '/conf'),
    onboardUserHelpers = require ('./onboardUserHelpers'),
    winston         = require(serverCommon + '/lib/winstonWrapper').winston,
    mongoose        = require(serverCommon + '/lib/mongooseConnect').mongoose;

UserModel = mongoose.model('User');

var callbackURL = 'https://' + conf.domain + "/oauth2callback";
if (conf.useNgrok) {
  callbackURL = conf.ngrokURL + "/oauth2callback";
}

winston.doInfo ('ouath callbackURL', {url : callbackURL})

passport.use('google', new GoogleStrategy({
    clientID: conf.google.appId,
    clientSecret: conf.google.appSecret,
    callbackURL: callbackURL,
    passReqToCallback : true
  },
  function(req, accessToken, refreshToken, params, profile, done) {
    
    var state;

    try {
      state = JSON.parse (req.query.state);
    } catch (e) {
      winston.doError ('error json parse', {msg : e.message, stack : e.stack});
      return done ({'error' : 'internal error'});
    }

    passport.extractUserData (accessToken, refreshToken, params, profile, function (err, userData) {

      if (err) {
        return done (err);
      }

      if (state.email !== userData.email) {
        winston.doWarn ('userEmail and google callback email do not match', {google : userData.email, user : state.email});
        //{'error' : 'mismatch emails', 'target' : state.email}
        return done (null, {'error' : 'mismatch email', 'message' : 'Please try again and choose your ' + state.email + ' account'});
      }

      UserModel.findOne ({googleID : profile.id}, function (err, foundUser) {
        if  (err) {
          return done (err);
        }
        else if (!foundUser) {
          var newUser = new UserModel(userData);
          saveUser(newUser);
        }
        else {
          for (var prop in userData) {
            if (userData.hasOwnProperty(prop)) {
              foundUser[prop] = userData[prop];
            }
          }

          saveUser (foundUser);
        }
      });


    });

    function saveUser (user) {
      winston.doInfo ('save user', {userId : user._id});

      user.save (function (err) {
        if (err){
          return done (err)
        }
        else {

          // remove secret fields before sending back
          user.symHash = undefined;
          user.symSalt = undefined;
          user.asymSalt = undefined;
          user.accessHash = undefined;

          // get the onboarding state of this user...
          onboardUserHelpers.checkUserOnboardingState (user, function (err, onboardComplete) {
            if (err) {
              return (done (err));
            } 
            else if (!onboardComplete) {
              onboardUserHelpers.createIndexAlias (user, function (err) {
                if (err) { return done (err); }
    

                onboardUserHelpers.addGmailScrapingJob (user, function (err) {
                  if (err) { return done (err); }

                  return done (null, user);
                });

              });
            } 
            else {
              return done (null, user);
            }
          });
          
        }
      })
    }

  }
));


passport.callGoogleAuth = function (req, res) {

  var googleOptions = {
    accessType: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://mail.google.com/',
            'https://www.googleapis.com/auth/drive.readonly'],
    state : JSON.stringify ({email : req.query.userEmail})
  }

  // check db for user... force if refresh token is marked invalid
  // or user is not found... otherwise don't force reauth
  UserModel.findOne ({email : req.query.userEmail}, function (err, foundUser) {

    if (err) {
      res.send ({error : 'internal error'}, 500);
    }
    else if (!foundUser) {
      googleOptions.approvalPrompt ='force';
    }
    else if (!foundUser.asymHash || foundUser.invalidToken) {
      googleOptions.approvalPrompt ='force';
    }

    passport.authenticate('google', googleOptions)(req, res);

  });

}

passport.extractUserData = function (accessToken, refreshToken, params, profile, callback) {
  var obj = profile._json;
  var data = {
    googleID: profile.id,
    accessToken: accessToken,
    displayName: obj.name,
    firstName: obj.given_name,
    lastName: obj.family_name,
    email: obj.email,
    invalidToken : false
  };

  if (obj.gender) data.gender = obj.gender;
  if (obj.locale) data.locale = obj.locale;
  if (obj.hd) data.hostedDomain = obj.hd;
  if (obj.picture) data.picture = obj.picture;
  if (params.expires_in) {
    data.expiresAt = Date.now() + 1000*params.expires_in;
  }

  if (refreshToken) {
    // this will set the symmetric hash (mongoose takes care of this, refreshToken is a virtual field)
    data.refreshToken = refreshToken;
  
    // bcrypt to generate asym hash
    bcrypt.genSalt(8, function(err, salt) {
      if (err) {
        winston.doError ('Error generating refreshToken salt', {err : err});
        callback (err);    
      }
      else {

        bcrypt.hash(refreshToken, salt, function(err, hash) {
          if (err) {
            winston.doError ('Error generating refreshToken hash', {err : err});
            callback (err);
            return;
          }

          data.asymHash = hash;
          data.asymSalt = salt;
          callback (null, data);
        });
      }
    });
  }
  else {
    callback (null, data);
  }
}

passport.serializeUser(function(user, done) {
  // TODO: can we just avoid this step all together?
  if (user._id) {
    done (null, user._id);
  } else {
    done (null, "blah");
  }
});

passport.deserializeUser(function(userId, done) {
  UserModel.findById(userId, function(err, user) {
    done(err, user);
  });
});


passport.ensureAuthenticated  = function(req, res, next) {
  if (!req) {
    return res.send ('user not authenticated', 401);
  }

  var userEmail = req.query.userEmail;
  var asymHash = req.query.asymHash;

  if (!userEmail) {
    userEmail = req.body.userEmail;
  }

  if (!asymHash) {
    asymHash = req.body.asymHash;
  }

  var query = {
    email : userEmail,
    asymHash : asymHash
  }

  UserModel.findOne (query, function (err, foundUser) {
    if (err) {
      return res.send ({error : 'internal error'}, 500);
    }
    else if (!foundUser) {
      return res.send ('user not authenticated', 401);
    }
    else {
      req.user = foundUser;
      return next();
    }
  });

};

module.exports = passport;

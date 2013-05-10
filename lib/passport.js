var serverCommon = process.env.SERVER_COMMON;

var passport        = require('passport'),
    GoogleStrategy  = require('passport-google-oauth').OAuth2Strategy,
    bcrypt          = require('bcrypt'),
    conf            = require(serverCommon + '/conf'),
    onboardUserHelpers = require ('./onboardUserHelpers'),
    winston         = require(serverCommon + '/lib/winstonWrapper').winston,
    mongoose        = require(serverCommon + '/lib/mongooseConnect').mongoose;

UserModel = mongoose.model('User');


passport.use('google', new GoogleStrategy({
    clientID: conf.google.appId,
    clientSecret: conf.google.appSecret,
    callbackURL: 'https://' + conf.domain + "/oauth2callback"
  },
  function(accessToken, refreshToken, params, profile, done) {

    passport.extractUserData (accessToken, refreshToken, params, profile, function (err, userData) {

      if (err) {
        return done (err);
      }

      UserModel.findOne ({googleID : profile.id}, function (err, foundUser) {
        if  (err) {
          return done (err);
        }
        else if (!foundUser) {
          var newUser = new UserModel(userData);
          saveUser(newUser, true);
        }
        else {
          for (var prop in userData) {
            if (userData.hasOwnProperty(prop)) {
              foundUser[prop] = userData[prop];
            }
          }

          saveUser (foundUser, false);
        }
      });


    });

    function saveUser (user, isNew) {
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

          if (isNew) {
            onboardUserHelpers.createIndexAlias (user, function (err) {
              if (err) { return done (err); }
  
              onboardUserHelpers.addGmailScrapingJob (user, function (err) {
                if (err) {return done (err);}

                return done (null, user);
              });

            });
          } else {
            return done (null, user);
          }
          
        }
      })
    }

  }
));


passport.callGoogleAuth = function (req, res) {
  winston.info ('callGoogleAuth');

  var googleOptions = {
    accessType: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://mail.google.com/',
            'https://www.googleapis.com/auth/drive.readonly']
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
    // TODO: async check of refreshToken validity so we can delete if invalid...
    else if (foundUser && !foundUser.asymHash) {
      googleOptions.approvalPrompt ='force';
    }

    passport.authenticate('google', googleOptions)(req, res);

  });

}

/*
passport.use('refresh', new RefreshStrategy({
    clientID: conf.google.appId,
    clientSecret: conf.google.appSecret
  }, function(email, refreshToken, done) {
  console.log('verifying');

  var strategy = this;

  UserModel.findOne({'email': email}, function(err, foundUser) {
    if (err) return done(err);
    if (!foundUser) return done(null, false);
    console.log('foundUser', foundUser);

    strategy.refreshToken(refreshToken, function(err, accessToken, expiresAt) {
      if (err) return done(err);
      foundUser.accessToken = accessToken;
      foundUser.expiresAt = expiresAt;
      foundUser.save(function(err) {
        if (err) return done(err);
        return done(null, foundUser);
      });
    });
  });

}));
*/

passport.extractUserData = function (accessToken, refreshToken, params, profile, callback) {
  var obj = profile._json;
  var data = {
    googleID: profile.id,
    accessToken: accessToken,
    displayName: obj.name,
    firstName: obj.given_name,
    lastName: obj.family_name,
    email: obj.email
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
        console.error (err);
        winston.doError ('Error generating refreshToken hash', {err : err});
        callback (err);    
      }
      else {

        bcrypt.hash(refreshToken, salt, function(err, hash) {
          if (err) {
            console.error (err);
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
  done(null, user._id);
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


  //TODO: remove backwards compatibility

  var userEmail = req.query.userEmail;
  var asymHash = req.query.asymHash;
  var refreshToken = req.query.refreshToken;

  if (!userEmail) {
    userEmail = req.body.userEmail;
  }

  if (!asymHash) {
    asymHash = req.body.asymHash;
  }

  if (!refreshToken) {
    refreshToken = req.body.refreshToken;
  }

  var query = {
    email : userEmail
  }

  if (!asymHash) {
    winston.doWarn ('User is still authenticating with refreshToken', {userEmail : userEmail});
    return res.send ({error : "client needs to upgrade extension"}, 400);
  }
  else {
    query.asymHash = asymHash;
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

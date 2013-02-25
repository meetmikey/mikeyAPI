var commonPath = process.env.SERVER_COMMON;

var passport       = require('passport'),
    GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
    RefreshStrategy = require('./refreshStrategy'),
    conf           = require(commonPath + '/conf'),
    mongoose       = require(commonPath + '/lib/mongooseConnect').mongoose;

UserModel = mongoose.model('User');


passport.use('google', new GoogleStrategy({
    clientID: conf.google.appId,
    clientSecret: conf.google.appSecret,
    callbackURL: 'https://' + conf.domain + "/oauth2callback"
  },
  function(accessToken, refreshToken, params, profile, done) {
    // persist!
    var userData = extractUserData(accessToken, refreshToken, params, profile);

    /*
    //TODO: error coming back here when used against mongoHQ = weird
    //https://github.com/mongodb/node-mongodb-native/issues/699

    UserModel.findOneAndUpdate({googleID: profile.id}, userData, {upsert: true},
      function(err, user) {
        return done(null, user);
      });
    */

    UserModel.findOne ({googleID : profile.id}, function (err, foundUser) {
      if  (err) {
        return done (err)
      }
      else if (!foundUser) {
        var newUser = new UserModel(userData)
        saveUser(newUser)
      }
      else {
        for (var prop in userData) {
          if (userData.hasOwnProperty(prop)) {
            foundUser[prop] = userData[prop];
          }
        }

        saveUser (foundUser);

      }
    })


    function saveUser (user) {
      user.save (function (err) {
        if (err){
          return done (err)
        }
        else {
          return done (null, user)
        }
      })
    }

  }
));

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

function extractUserData(accessToken, refreshToken, params, profile) {
  var obj = profile._json;
  var data = {
          googleID: profile.id,
          accessToken: accessToken,
          displayName: obj.name,
          firstName: obj.given_name,
          lastName: obj.family_name,
          email: obj.email
          };
   if (refreshToken) data.refreshToken = refreshToken;
   if (obj.gender) data.gender = obj.gender;
   if (obj.locale) data.locale = obj.locale;
   if (obj.hd) data.hostedDomain = obj.hd;
   if (obj.picture) data.picture = obj.picture;
   if (params.expires_in) {
    data.expiresAt = Date.now() + 1000*params.expires_in;
   }
   return data;
}

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(userId, done) {
  UserModel.findById(userId, function(err, user) {
    console.log ('err', err)
    console.log ('user', user)
    done(err, user);
  });
});

passport.ensureAuthenticated  = function(req, res, next) {

  if (!req) {
    return res.send ('user not authenticated', 401);
  }

  var userEmail = req.query.userEmail;
  var refreshToken = req.query.refreshToken;

  if (!userEmail) {
    userEmail = req.body.userEmail;
  }

  if (!refreshToken) {
    refreshToken = req.body.refreshToken;
  }

  console.log('checking auth for', userEmail, 'with token:', refreshToken);
  UserModel.findOne ({email: userEmail, refreshToken : refreshToken}, function (err, foundUser) {
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

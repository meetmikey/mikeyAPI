var serverCommon = process.env.SERVER_COMMON;

var passport        = require('passport'),
    GoogleStrategy  = require('passport-google-oauth').OAuth2Strategy,
    RefreshStrategy = require('./refreshStrategy'),
    bcrypt          = require('bcrypt'),
    crypto          = require('crypto'),
    conf            = require(serverCommon + '/conf'),
    winston         = require(serverCommon + '/lib/winstonWrapper').winston,
    mongoose        = require(serverCommon + '/lib/mongooseConnect').mongoose;


var cryptoSecret;

if (process.env.NODE_ENV == 'production') {
  cryptoSecret = require (serverCommon + '/secureConf').crypto.aesSecret;
}
else {
  cryptoSecret = require (serverCommon + '/conf').crypto.aesSecret;
}

var cipher = crypto.createCipher(conf.crypto.scheme, cryptoSecret);

UserModel = mongoose.model('User');


passport.use('google', new GoogleStrategy({
    clientID: conf.google.appId,
    clientSecret: conf.google.appSecret,
    callbackURL: 'https://' + conf.domain + "/oauth2callback"
  },
  function(accessToken, refreshToken, params, profile, done) {

    // persist!
    passport.extractUserData(accessToken, refreshToken, params, profile, function (err, userData) {
      if (err) {
        return done (err);
      }

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

    });

    function saveUser (user) {
      user.save (function (err) {
        if (err){
          return done (err)
        }
        else {
          // remove secret fields before sending back
          //user.sym = undefined;
          user.symSalt = undefined;
          //user.asymSalt = undefined;
          user.accessSym = undefined;

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

//  console.log ('THE REFRESH TOKEN', refreshToken);
//  console.log ('THE ACCESS TOKEN', accessToken);

  if (obj.gender) data.gender = obj.gender;
  if (obj.locale) data.locale = obj.locale;
  if (obj.hd) data.hostedDomain = obj.hd;
  if (obj.picture) data.picture = obj.picture;
  if (params.expires_in) {
    data.expiresAt = Date.now() + 1000*params.expires_in;
  }

  if (refreshToken) {
    data.refreshToken = refreshToken;
  }

  callback (null, data);

  // store a symmetric and asymmetric hash of the refreshToken
  // we don't do this in a mongoose setter since the bcrypt call is async
  /*
  if (refreshToken) { 
    data.symSalt = crypto.randomBytes (8).toString ('hex');
    var symmetricHash = cipher.update (data.symSalt + refreshToken, 'utf8', 'hex');
    symmetricHash += cipher.final ('hex');
    data.sym = symmetricHash;

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

          data.asym = hash;
          data.asymSalt = salt;
          callback (null, data);
        });

      }
    });
  }
  else {
    callback (null, data);
  }
  */

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

  var userEmail = req.query.userEmail;
  var refreshToken = req.query.refreshToken;

  if (!userEmail) {
    userEmail = req.body.userEmail;
  }

  if (!refreshToken) {
    refreshToken = req.body.refreshToken;
  }

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

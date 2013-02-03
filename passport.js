var commonPath = process.env.SERVER_COMMON;

var passport       = require('passport'),
    GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
    mongoose       = require(commonPath + '/lib/mongooseConnect'),
    User           = require(commonPath + '/schema/user');


passport.use(new GoogleStrategy({
    clientID: '1020629660865.apps.googleusercontent.com',
    clientSecret: 'pFvM2J42oBnUFD9sI1ZwITFE',
    callbackURL: "https://local.meetmikey.com/oauth2callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // persist!
    var userData = extractUserData(accessToken, refreshToken, profile);
    User.findOneAndUpdate({googleID: profile.id}, userData, {upsert: true},
      function(err, user) {
        return done(err, user);
    });
  }
));

function extractUserData(accessToken, refreshToken, profile) {
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
   return data;
}

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findOne({googleID: id}, function(err, user) {
    done(err, user);
  });
});

module.exports = passport;

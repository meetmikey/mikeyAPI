var commonPath = process.env.SERVER_COMMON;

var passport       = require('passport'),
    GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
    conf           = require(commonPath + '/conf'),
    mongoose       = require(commonPath + '/lib/mongooseConnect'),
    User           = require(commonPath + '/schema/user');


passport.use(new GoogleStrategy({
    clientID: conf.google.appId,
    clientSecret: conf.google.appSecret,
    callbackURL: "https://local.meetmikey.com/oauth2callback"
  },
  function(accessToken, refreshToken, profile, done) {
    console.log ('accessToken', accessToken)
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
  done(null, user._id);
});

passport.deserializeUser(function(_id, done) {
  User.findOne({_id: _id}, function(err, user) {
    console.log ('err', err)
    console.log ('user', user)
    done(err, user);
  });
});

module.exports = passport;

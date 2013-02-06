var commonPath = process.env.SERVER_COMMON;

var passport       = require('passport'),
    GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
    conf           = require(commonPath + '/conf'),
    mongoose       = require(commonPath + '/lib/mongooseConnect').mongoose;

UserModel = mongoose.model ('User')

passport.use(new GoogleStrategy({
    clientID: conf.google.appId,
    clientSecret: conf.google.appSecret,
    callbackURL: "https://local.meetmikey.com/oauth2callback"
  },
  function(accessToken, refreshToken, profile, done) {
    console.log ('accessToken', accessToken)
    // persist!
    var userData = extractUserData(accessToken, refreshToken, profile);

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
        var newUser = new UserModel ({
          googleID: userData.googleID,
          accessToken: userData.accessToken,
          displayName: userData.displayName,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email
        })

        saveUser (newUser)

      }
      else {
        foundUser.accessToken = userData.accessToken
        foundUser.firstName = userData.firstName
        foundUser.lastName = userData.lastName
        foundUser.displayName = userData.displayName

        saveUser (foundUser)

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

passport.deserializeUser(function(userId, done) {
  UserModel.findById(userId, function(err, user) {
    console.log ('err', err)
    console.log ('user', user)
    done(err, user);
  });
});

module.exports = passport;

var express        = require('express'),
    mongoose       = require('mongoose'),
    passport       = require('passport'),
    GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

passport.use(new GoogleStrategy({
    clientID: 'ABC',
    clientSecret: 'XYZ',
    callbackURL: "http:/127.0.0.1/auth/google/callback"
  },
  function(token, tokenSecret, profile, done) {
    // persist!
  }
));

var app = module.exports = express();

app.get('/auth/google', passport.authenticate('google'));

app.get('/auth/google/callback', passport.authenticate('google'), function(req, res) {
  console.log('authorized!');
});

app.listen(8080, function() {
  console.log('mikey api now running on port 8080');
});

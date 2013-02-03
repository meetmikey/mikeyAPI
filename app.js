var serverCommon = process.env.SERVER_COMMON;

var express           = require('express'),
    mongoose          = require(serverCommon + '/lib/mongooseConnect').mongoose,
    passport          = require('passport'),
    GoogleStrategy    = require('passport-google-oauth').OAuth2Strategy,
    conf              = require(serverCommon + '/conf'),
    fs                = require('fs'),
    https             = require('https'),
    routeAttachments  = require('./routes/attachments');

passport.use(new GoogleStrategy({
    clientID: '1020629660865.apps.googleusercontent.com',
    clientSecret: 'pFvM2J42oBnUFD9sI1ZwITFE',
    callbackURL: "https://local.meetmikey.com/oauth2callback"
  },
  function(token, tokenSecret, profile, done) {
    // persist!
    done(null, profile);
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {

});

var options = {key: fs.readFileSync('keyslocal/privateKey.key'),
  cert: fs.readFileSync('keyslocal/alpha.magicnotebook.com.crt')};

var app = module.exports = express();

app.configure(function() {
  app.use(express.logger({ format:'\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :date \x1b[0m :response-time ms' }));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(passport.initialize());
});

app.get('/auth/google',
        passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/userinfo.profile',
                                                  'https://www.googleapis.com/auth/userinfo.email',
                                                  'https://mail.google.com/mail/feed/atom'] }
));

app.get('/oauth2callback', passport.authenticate('google', {failureRedirect: '/wtf'}), function(req, res) {
  console.log('authorized!');
  res.send('you are authed!');
});

https.createServer(options, app).listen(8080, function() {
  console.log('mikey api running on port 8080');
});

app.get('/attachment', routeAttachments.getAttachments);
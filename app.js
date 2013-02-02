var commonPath = '../serverCommon/';

var express        = require('express'),
    mongoose       = require('mongoose'),
    users          = require(commonPath + 'schema/user'),
    passport       = require('./passport'),
    commonConf     = require(commonPath + 'conf'),
    fs             = require('fs'),
    https          = require('https');

var options = {key: fs.readFileSync('keyslocal/privateKey.key'),
  cert: fs.readFileSync('keyslocal/alpha.magicnotebook.com.crt')};

var app = module.exports = express();

app.configure(function() {
  app.use(express.logger({ format:'\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :date \x1b[0m :response-time ms' }));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));

  var mongoPath = 'mongodb://' + commonConf.mongo.local.host + '/' + commonConf.mongo.local.db;
  mongoose.connect(mongoPath, function (err) {
    if (err) throw err;
  });

  app.use(passport.initialize());
});

app.get('/auth/google',
        passport.authenticate('google', { accessType: 'offline',
                                          scope: ['https://www.googleapis.com/auth/userinfo.profile',
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

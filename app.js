var express           = require('express'),
    passport          = require('./passport'),
    constants         = require('./constants'),
    mongoose          = require(constants.SERVER_COMMON + '/lib/mongooseConnect').mongoose,
    GoogleStrategy    = require('passport-google-oauth').OAuth2Strategy,
    conf              = require(constants.SERVER_COMMON + '/conf'),
    fs                = require('fs'),
    https             = require('https'),
    oauth             = require ('oauth'),
    onboardUserHelpers = require ('./lib/onboardUserHelpers'),
    winston           = require(constants.SERVER_COMMON + '/lib/winstonWrapper').winston,
    routeAttachments  = require('./routes/attachments');

var options = {key: fs.readFileSync('keyslocal/privateKey.key'),
  cert: fs.readFileSync('keyslocal/alpha.magicnotebook.com.crt')};

var app = module.exports = express();

//TODO: replace with redis store
var MemoryStore = express.session.MemoryStore,
    sessionStore = new MemoryStore();

app.configure(function() {
  app.use(express.logger({ format:'\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :date \x1b[0m :response-time ms' }));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(express.bodyParser())  
  app.use(express.cookieParser(conf.express.secret)); 
  app.use(express.session({store: sessionStore})); 
  app.use(express.methodOverride())
  app.use(express.static(__dirname + '/public'))
  app.use(express.compress())
  app.use(passport.initialize());
  app.use(passport.session());
});

app.configure('localhost', function(){


})

app.configure('development', function(){


})

app.configure('production', function(){


})

app.get('/auth/google',
        passport.authenticate('google', { accessType: 'offline',
                                          approvalPrompt: 'force',
                                          scope: ['https://www.googleapis.com/auth/userinfo.profile',
                                                  'https://www.googleapis.com/auth/userinfo.email',
                                                  'https://mail.google.com/'] }
));

app.get('/oauth2callback', passport.authenticate('google', {failureRedirect: '/wtf'}), function(req, res) {
  console.log('authorized!');
  res.send('you are authed!');

  onboardUserHelpers.addGmailScrapingJob (req.user)

});

https.createServer(options, app).listen(8080, function() {
  console.log('mikey api running on port 8080');
});


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   auth page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/auth/google')
}


app.get('/attachment',  ensureAuthenticated, routeAttachments.getAttachments);

app.get('/attachmentURL/:attachmentId',  ensureAuthenticated, routeAttachments.goToAttachmentSignedURL);

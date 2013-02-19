var express             = require('express'),
    passport            = require('./lib/passport'),
    constants           = require('./constants'),
    expressValidator    = require('express-validator'),
    mongoose            = require(constants.SERVER_COMMON + '/lib/mongooseConnect').mongoose,
    GoogleStrategy      = require('passport-google-oauth').OAuth2Strategy,
    conf                = require(constants.SERVER_COMMON + '/conf'),
    fs                  = require('fs'),
    https               = require('https'),
    onboardUserHelpers  = require ('./lib/onboardUserHelpers'),
    winston             = require(constants.SERVER_COMMON + '/lib/winstonWrapper').winston,
    routeLinks          = require('./routes/links'),
    routeSearch         = require('./routes/search'),
    routeAttachments    = require('./routes/attachments');

var options = {key: fs.readFileSync('keyslocal/privateKey.key'),
  cert: fs.readFileSync('keyslocal/alpha.magicnotebook.com.crt')};

var app = module.exports = express();

//TODO: replace with redis store
var MemoryStore = express.session.MemoryStore,
    sessionStore = new MemoryStore();

app.configure(function() {
  app.engine('html', require('ejs').__express)
  app.use(express.logger({ format:'\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :date \x1b[0m :response-time ms' }));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(express.bodyParser())
  app.use(express.cookieParser(conf.express.secret));
  app.use(express.session({store: sessionStore}));
  app.use(express.methodOverride())
  app.use(express.static(__dirname + '/public'))
  app.use(express.compress())
  app.use(expressValidator)
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

app.get('/oauth2callback', passport.authenticate('google', {failureRedirect: '/oauth_failure'}), function(req, res) {
  console.log('authorized!', req.user);
  res.render('callback.html', { message: JSON.stringify(req.user) } );

  onboardUserHelpers.addGmailScrapingJob (req.user)
});

app.get('/oauth_failure', function(req, res) {
  res.render('oauth_failure.html');
});

app.post('/auth/refresh', passport.authenticate('refresh'), function(req, res) {
  res.send(req.user);
});

https.createServer(options, app).listen(8080, function() {
  console.log('mikey api running on port 8080');
});


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   auth page.


app.get('/attachment',  passport.ensureAuthenticated, routeAttachments.getAttachments);

app.get('/attachmentURL/:attachmentId',  passport.ensureAuthenticated, routeAttachments.goToAttachmentSignedURL);

app.get('/link',  passport.ensureAuthenticated, routeLinks.getLinks);

app.get('/search',  passport.ensureAuthenticated, routeSearch.getSearchResults);
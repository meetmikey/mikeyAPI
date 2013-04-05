var serverCommon = process.env.SERVER_COMMON;

var express             = require('express'),
    passport            = require('./lib/passport'),
    constants           = require('./constants'),
    expressValidator    = require('express-validator'),
    GoogleStrategy      = require('passport-google-oauth').OAuth2Strategy,
    conf                = require(serverCommon + '/conf'),
    mikeyAPIConf        = require('./conf'),
    fs                  = require('fs'),
    https               = require('https'),
    routeLinks          = require('./routes/links'),
    routeSearch         = require('./routes/search'),
    routeUser           = require('./routes/user'),
    routeAttachments    = require('./routes/attachments'),
    routeDebug          = require('./routes/debug'),
    routeOnboarding     = require ('./routes/onboarding'),
    routeCounts         = require ('./routes/counts'),
    memwatch            = require('memwatch'),
    routeImages         = require('./routes/images'),
    winston             = require (serverCommon + '/lib/winstonWrapper').winston,
    appInitUtils        = require(serverCommon + '/lib/appInitUtils');

var initActions = [
    appInitUtils.CONNECT_ELASTIC_SEARCH
  , appInitUtils.CONNECT_MONGO
];

//initApp() will not callback an error.
//If something fails, it will just exit the process.
appInitUtils.initApp( 'mikeyAPI', initActions, conf, function() {

  var app = module.exports = express();

  app.configure(function() {
    app.engine('html', require('ejs').__express)
    app.use(express.logger({ format:'\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :date \x1b[0m :response-time ms' }));
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    app.use(express.bodyParser())
    app.use(express.cookieParser(conf.express.secret));
    app.use(express.methodOverride())
    app.use(express.static(__dirname + '/public'))
    app.use(express.compress())
    app.use(expressValidator)
    app.use(passport.initialize());
  });

  var options = {};
  app.configure('localhost', function(){
    options = {
        key: fs.readFileSync( mikeyAPIConf.sslKeysLocal.keyFile )
      , cert: fs.readFileSync( mikeyAPIConf.sslKeysLocal.crtFile )
    };
  });

  app.configure('development', function(){
    options = {
        key: fs.readFileSync(mikeyAPIConf.sslKeys.keyFile)
      , cert: fs.readFileSync(mikeyAPIConf.sslKeys.crtFile)
      , ca: [
            fs.readFileSync(mikeyAPIConf.sslKeys.caFile1)
          , fs.readFileSync(mikeyAPIConf.sslKeys.caFile2)
        ]
    };
  });

  app.configure('production', function(){
    options = {
        key: fs.readFileSync(mikeyAPIConf.sslKeys.keyFile)
      , cert: fs.readFileSync(mikeyAPIConf.sslKeys.crtFile)
      , ca: [
            fs.readFileSync(mikeyAPIConf.sslKeys.caFile1)
          , fs.readFileSync(mikeyAPIConf.sslKeys.caFile2)
        ]
    };
  })

  app.get('/auth/google', passport.callGoogleAuth);

  app.get('/oauth2callback', passport.authenticate('google', {failureRedirect: '/oauth_failure'}), function(req, res) {
    res.render('callback.html', { message: JSON.stringify(req.user) } );
  });

  app.get('/oauth_failure', function(req, res) {
    res.render('oauth_failure.html');
  });

  app.get('/attachment',  passport.ensureAuthenticated, routeAttachments.getAttachments);

  app.get('/attachmentURL/:attachmentId',  passport.ensureAuthenticated, routeAttachments.goToAttachmentSignedURL);

  app.get('/image',  passport.ensureAuthenticated, routeImages.getImages);

  app.get('/link',  passport.ensureAuthenticated, routeLinks.getLinks);

  app.get('/search',  passport.ensureAuthenticated, routeSearch.getSearchResults);

  app.get('/onboarding',  passport.ensureAuthenticated, routeOnboarding.getOnboardingState);

  app.delete('/attachment/:attachmentId', passport.ensureAuthenticated, routeAttachments.deleteAttachment);

  app.delete('/attachment', passport.ensureAuthenticated, routeAttachments.deleteAttachmentBulk);

  app.delete('/link/:linkId', passport.ensureAuthenticated, routeLinks.deleteLink);

  app.delete('/link', passport.ensureAuthenticated, routeLinks.deleteLinkBulk);

  app.get('/user', routeUser.getCurrentUser);

  app.get ('/counts', passport.ensureAuthenticated, routeCounts.getCounts);

  app.post ('/debug', routeDebug.postClientBug);

  //Used by the load balancer to check whether this API is working.
  //mv views/index.html to stop traffic from the load balancer.
  app.get('/index.html', function(req, res) {
    res.render('index.html');
  });


  https.createServer(options, app).listen(8080, function() {
    console.log('mikey api running on port 8080');
  });


  // Simple route middleware to ensure user is authenticated.
  //   Use this route middleware on any resource that needs to be protected.  If
  //   the request is authenticated (typically via a persistent login session),
  //   the request will proceed.  Otherwise, the user will be redirected to the
  //   auth page.

});
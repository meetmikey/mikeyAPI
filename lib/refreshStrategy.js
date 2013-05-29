var passport = require('passport'),
    util = require('util'),
    OAuth2 = require('oauth').OAuth2;

function Strategy(options, verify) {
  if (typeof options == 'function') {
    verify = options;
    options = {};
  }
  if (!verify) throw new Error('refresh strategy requires a verify function');
  if (!options.clientID) throw new Error('refresh strategy requires a clientID option');
  if (!options.clientSecret) throw new Error('refresh strategy requires a clientSecret option');

  passport.Strategy.call(this);

  var authorizePath = 'https://accounts.google.com/o/oauth2/auth';
  var accessTokenPath = 'https://accounts.google.com/o/oauth2/token';

  this._oauth2 = new OAuth2(options.clientID, options.clientSecret, '', authorizePath, accessTokenPath);

  this.name = 'refresh';
  this._verify = verify;
}

util.inherits(Strategy, passport.Strategy);

Strategy.prototype.authenticate = function(req, options) {
  options = options || {};

  if (!req.body.email) this.fail({message: 'email required to refresh'});
  if (!req.body.refreshToken) this.fail({message: 'refreshToken required to refresh'});

  var self = this;
  function verified(err, user, info) {
    if (err) return self.error(err);
    if (!user) return self.fail(info);
    self.success(user, info);
  }
  this._verify(req.body.email, req.body.refreshToken, verified);
};

Strategy.prototype.refreshToken = function(refreshToken, done) {
  this._oauth2.getOAuthAccessToken(refreshToken,
                                  {grant_type: 'refresh_token', refresh_token: refreshToken},
                                  function(error, accessToken, refreshToken, results) {
                                    if (error) return done(error);
                                    var expiresAt = Date.now() + 1000*results.expires_in;
                                    return done(null, accessToken, expiresAt);
                                  });
};



module.exports = Strategy;

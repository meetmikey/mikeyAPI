function define(name, value) {
  Object.defineProperty(exports, name, {
    value : value,
    enumerable: true
  });
}

var environment = process.env.NODE_ENV;

if(environment === 'production') {
  define('ENV', 'production');
}
else if(environment === 'development') {
  define('ENV', 'development');
}
else{
  define('ENV', 'local');
}

define('LISTEN_PORT', 8080);

define('DEFAULT_USER_FIELDS', 'googleID shortId asymHash expiresAt displayName firstName lastName email gender locale hostedDomain picture gmailScrapeRequested timestamp invalidToken twitterReferralLink facebookReferralLink directReferralLink isPremium daysLimit minMailDate');
define('IMAGE_EXPIRE_TIME_MINUTES', 1440); //24 hours
define('FILE_EXPIRE_TIME_MINUTES', 5); //5 minutes
define('SEARCH_THRESHOLD', 0);
define('ABSOLUTE_MIN_SCORE', .01);
define('DEFAULT_RESOURCE_LIMIT', 50);
define('DEFAULT_IMAGE_RESOURCE_LIMIT', 15);
define('ACTIVE_CONNECTION_REQUEUE_CUTOFF', 60*1000*5); // 5 minutes
define('DONE_THRESHOLD', .75);

define ('DOM_DIR', '/var/log/mikey/mikeyAPI/doms/');
define('REFERRAL_COOKIE_MAX_AGE',   30 * 24 * 60 * 60 * 1000); // 30 days
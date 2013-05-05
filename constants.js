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

define('DEFAULT_FIELDS_ATTACHMENT', 'userId filename contentType sentDate sender recipients image isImage hash fileSize isDeleted gmMsgId gmMsgHex docType attachmentThumbExists');
define('DEFAULT_FIELDS_LINK', 'userId url resolvedURL sentDate sender recipients image title summary comparableURLHash isDeleted gmMsgId gmMsgHex imageThumbExists');
define('DEFAULT_USER_FIELDS', 'googleID asymHash expiresAt displayName firstName lastName email gender locale hostedDomain picture gmailScrapeRequested timestamp');
define('IMAGE_EXPIRE_TIME_MINUTES', 1440); //24 hours
define('FILE_EXPIRE_TIME_MINUTES', 5); //5 minutes
define('SEARCH_THRESHOLD', 0);
define('ABSOLUTE_MIN_SCORE', .01);
define('DEFAULT_MAX_ITEMS', 50);
define('DEFAULT_RESOURCE_LIMIT', 50);
define('DEFAULT_IMAGE_RESOURCE_LIMIT', 25);
define('IMAGE_DEDUPE_ADJUSTMENT_FACTOR', 1.4);  //non-scientific test showed ratio of 1.32.
define('ACTIVE_CONNECTION_REQUEUE_CUTOFF', 60*1000*10); // 5 minutes
define('DONE_THRESHOLD', .75);

define ('DOM_DIR', '/var/log/mikey/mikeyAPI/doms/');

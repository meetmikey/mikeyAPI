function define(name, value) {
  Object.defineProperty(exports, name, {
    value : value,
    enumerable: true
  });
}

var environment = process.env.NODE_ENV

if(environment === 'production') {
  define('ENV', 'production')
}
else if(environment === 'development') {
  define('ENV', 'development')
}
else{
  define('ENV', 'localhost')
}

define('SERVER_COMMON', process.env.SERVER_COMMON)

define('USE_SPOOFED_USER', false)
define('SPOOFED_USER_ID', '5119c7b60746d47552000005')

define('DEFAULT_FIELDS_ATTACHMENT', 'filename contentType sentDate sender recipients image hash fileSize')
define('DEFAULT_FIELDS_LINK', 'url sentDate sender recipients image title text comparableURLHash')
define('URL_EXPIRE_TIME_MINUTES', 30)
define('SEARCH_THRESHOLD', .05)
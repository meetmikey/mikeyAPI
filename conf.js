
var environment = process.env.NODE_ENV;
var buildDir = process.env.MIKEY_BUILD;

var keyDir = './keysLocal/';
var installURL = 'http://meetmikey.com';

if (environment == 'production') {
  keyDir = buildDir + '/keys/';

} else if (environment == 'development') {
  keyDir = buildDir + '/keys/';
}

module.exports = {
    sslKeys: {
        keyFile: keyDir + 'meetmikey.key'
      , crtFile: keyDir + 'meetmikey.com.crt'
      , caFile1: keyDir + 'gd_cert1.crt'
      , caFile2: keyDir + 'gd_cert2.crt'
    }
  , sslKeysLocal: {
      keyFile: keyDir + 'privateKey.key'
    , crtFile: keyDir + 'local.meetmikey.com.crt'
  }
  , installURL: installURL
};
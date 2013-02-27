
var environment = process.env.NODE_ENV;

module.exports = {
    sslKeys: {
        keyFile: './keys/meetmikey.key'
      , crtFile: './keys/meetmikey.com.crt'
      , caFile1: './keys/gd_cert1.crt'
      , caFile2: './keys/gd_cert2.crt'
    }
  , sslKeysLocal: {
      keyFile: './keysLocal/privateKey.key'
    , crtFile: './keysLocal/local.meetmikey.com.crt'
  }
};
var serverCommon = process.env.SERVER_COMMON;

var s3Utils = require(serverCommon + '/lib/s3Utils')
  , winston = require(serverCommon + '/lib/winstonWrapper').winston

var expireTimeMinutes = 30;
var s3Path = '/attachment/61997c82ebc7c53c1e3a99083cae6c6f7ceb6ca9e4795145419b82516fc2480b_1474';
var headers = {};
var filename = 'hi'

//headers['response-content-disposition']  = 'inline;filename=' + filename;
//headers['response-content-disposition']  = 'inline;' + filename;

var signedURL = s3Utils.signedURL(s3Path, expireTimeMinutes, headers);

winston.doInfo('signedURL', {signedURL: signedURL});
var serverCommon = process.env.SERVER_COMMON;

var crypto = require ('crypto')
  , bcrypt = require ('bcrypt')
  , winston = require(serverCommon + '/lib/winstonWrapper').winston

var source = 'hello world' + ' my salt'
var secret = new Buffer ('mysecret')

winston.doInfo('secretLength', {secretLength: secret.length});

var cipher = crypto.createCipher("aes256", secret) // or createCipher
  , decipher = crypto.createDecipher("aes256", secret);


winston.doInfo('secret', {secret: secret});
winston.doInfo('source', {source: source});

var step = cipher.update(source, 'ascii', 'hex');
step += cipher.final ('hex')
winston.doInfo('step', {step: step});

var end = decipher.update(step, 'hex', 'ascii');
end += decipher.final ('ascii');

winston.doInfo('end', {end: end});

bcrypt.genSalt(8, function(err, salt) {
    bcrypt.hash("mysecret", salt, function(err, hash) {
      winston.doInfo('salt', {salt: salt});
      winston.doInfo('hash', {hash: hash});
    });
});
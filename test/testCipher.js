var crypto = require ('crypto');
var bcrypt = require ('bcrypt');

var source = 'hello world' + ' my salt'
var secret = new Buffer ('mysecret')

console.log (secret.length)

var cipher = crypto.createCipher("aes256", secret) // or createCipher
  , decipher = crypto.createDecipher("aes256", secret);


console.log ('secret', secret);
console.log ('source', source);

var step = cipher.update(source, 'ascii', 'hex');
step += cipher.final ('hex')
console.log ('step', step);

var end = decipher.update(step, 'hex', 'ascii');
end += decipher.final ('ascii');

console.log ('end', end)

bcrypt.genSalt(8, function(err, salt) {
    bcrypt.hash("mysecret", salt, function(err, hash) {
      console.log ('salt', salt)
      console.log ('hash', hash)
    });
});
var serverCommon = process.env.SERVER_COMMON;

var constants   = require('../constants'),
    sqsConnect  = require(serverCommon + '/lib/sqsConnect'),
    winston     = require(serverCommon + '/lib/winstonWrapper').winston,
    mongoose    = require(serverCommon + '/lib/mongooseConnect').mongoose,
    sqsConnect  = require(serverCommon + '/lib/sqsConnect'),
    ActiveConnectionModel = require(serverCommon + '/schema/active').ActiveConnectionModel

exports.updateLastAccessTime = function (user) {
  winston.doInfo ('updateLastAccessTime', {userEmail : user.email});
  var isoNow = new Date(Date.now()).toISOString();
  var isoNowWithBuffer = new Date (Date.now() - constants.ACTIVE_CONNECTION_REQUEUE_CUTOFF).toISOString();

  ActiveConnectionModel.findByIdAndUpdate (user._id, 
    {$set : {lastPoll : Date.now()}},
    {upsert : true, new : false},
    function (err, foundConn) {
      if (err) {
        winston.doError ('Mongo error updating last access time for active connection', {err : err})
      }
      else if (!foundConn._id) {
        winston.info ('Adding active connection message to queue because ActiveConnectionModel doesn\'t exist');
        sqsConnect.addMessageToMailActiveConnectionQueue (user);
      }
      else if (!foundConn.lastQueued || foundConn.lastQueued.toISOString() < isoNowWithBuffer) {

        foundConn.lastQueued = Date.now();

        foundConn.save (function (err) {
          if (err) {
            winston.doMongoError (err);
          }
          else {
            winston.info ('Adding active connection message to queue because mikeyMailTS hasn\'t updated timestamp in awhile');
            sqsConnect.addMessageToMailActiveConnectionQueue (user);
          }
        });
      }
    });
}
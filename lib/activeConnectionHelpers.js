var serverCommon = process.env.SERVER_COMMON;

var constants   = require('../constants'),
    sqsConnect  = require(serverCommon + '/lib/sqsConnect'),
    winston     = require(serverCommon + '/lib/winstonWrapper').winston,
    mongoose    = require(serverCommon + '/lib/mongooseConnect').mongoose,
    sqsConnect  = require(serverCommon + '/lib/sqsConnect')

var ActiveConnectionModel = mongoose.model ('ActiveConnection')

exports.updateLastAccessTime = function (user) {
  winston.info ('updateLastAccessTime');
  ActiveConnectionModel.findByIdAndUpdate (user._id, 
    {$set : {lastPoll : Date.now()}}, 
    {upsert : true, new : false}, 
    function (err, foundConn) {
      console.log (foundConn)
      if (err) {
        winston.doError ('Mongo error updating last access time for active connection', {err : err})
      }
      else if (!foundConn._id) {
        winston.info ('Adding active connection message to queue because ActiveConnectionModel doesn\'t exist');
        sqsConnect.addMessageToMailActiveConnectionQueue (user)
      }
      else if (!foundConn.mikeyMailTS || foundConn.mikeyMailTS < Date.now() - constants.ACTIVE_CONNECTION_REQUEUE_CUTOFF) {
        winston.info ('Adding active connection message to queue because node hasn\'t updated timestamp in awhile');
        sqsConnect.addMessageToMailActiveConnectionQueue (user)
      }
    });
}
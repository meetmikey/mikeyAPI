var constants   = require('../constants'),
    sqsConnect  = require(constants.SERVER_COMMON + '/lib/sqsConnect'),
    winston     = require(constants.SERVER_COMMON + '/lib/winstonWrapper').winston,
    mongoose    = require(constants.SERVER_COMMON + '/lib/mongooseConnect').mongoose

var ActiveConnectionModel = mongoose.model ('ActiveConnection')


exports.updateLastAccessTime = function (user) {
  ActiveConnectionModel.findByIdAndUpdate (user._id, 
    {$set : {lastPoll : Date.now()}}, 
    {upsert : true, new : false}, 
    function (err, foundConn) {
      if (err) {
        winston.doError ('Mongo error updating last access time for active connection', {err : err})
      }
      else if (!foundConn._id) {
        console.log ("TODO: push on queue")
      }
    });
}
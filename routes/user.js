var serverCommon = process.env.SERVER_COMMON;

var winston         = require(serverCommon + '/lib/winstonWrapper').winston,
    mongoose        = require(serverCommon + '/lib/mongooseConnect').mongoose;

var routeUser = this;
var UserModel = mongoose.model ('User')

exports.getCurrentUser = function (req, res) {
  var userEmail = req.query.userEmail;
  var refreshToken = req.query.refreshToken;

  UserModel.findOne ({email : userEmail, refreshToken : refreshToken},
    function (err, foundUser) {
      if (err) {
        res.send ({"error" :  "internal error"}, 500);
      }
      else if (!foundUser) {
        res.send ({"error" : "invalid credentials"}, 401);
      }
      else {
        res.send (foundUser);
      }
    });

}
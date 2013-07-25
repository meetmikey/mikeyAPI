var serverCommon = process.env.SERVER_COMMON;

var UserModel = require(serverCommon + '/schema/user').UserModel
	, UserUpgradeModel = require(serverCommon + '/schema/userUpgrade').UserUpgradeModel
  , winston = require(serverCommon + '/lib/winstonWrapper').winston
  , conf = require(serverCommon + '/conf')
  , utils = require(serverCommon + '/lib/utils')
	, stripe = require('stripe')(conf.stripe.secretKey);


var upgradeHelpers = this;


exports.chargeAndUpgradeUser = function(userEmail, billingPlan, stripeToken, callback) {

	if ( ! userEmail ) { callback( winston.makeMissingParamError('userEmail') ); return; }
	if ( ! billingPlan ) { callback( winston.makeMissingParamError('billingPlan') ); return; }
	if ( ! stripeToken ) { callback( winston.makeMissingParamError('stripeToken') ); return; }

	UserModel.findOne( {email: userEmail}, function(mongoErr, foundUser) {
		if ( mongoErr ) {
			callback( winston.makeMongoError(mongoErr) );

		} else if ( ! foundUser ) {
			callback( winston.makeError('no user', {email: userEmail}) );

		} else {
			upgradeHelpers.getStripeCustomerId( foundUser, stripeToken, function(err, stripeCustomerId) {
				if ( err ) {
					callback( err );

				} else {
					var userUpgrade = new UserUpgradeModel({
							userId: foundUser._id
						, billingPlan: billingPlan
						, stripeCustomerId: stripeCustomerId
					});

					userUpgrade.save( function(mongoErr) {
						if ( mongoErr ) {
							callback( winston.makeMongoError( mongoErr ) );

						} else if ( foundUser.billingPlan && ( foundUser.billingPlan == billingPlan ) ) {
							callback();

						} else {
							foundUser.billingPlan = billingPlan;
							foundUser.billingPlanStartDate = Date.now();
							foundUser.stripeToken = stripeToken;

							var updateData = {$set: {
					    		billingPlan: foundUser.billingPlan
					    	, billingPlanStartDate: foundUser.billingPlanStartDate
					    	, stripeToken: foundUser.stripeToken
					    }};

					    UserModel.findByIdAndUpdate( foundUser._id, updateData, function(mongoErr, updatedUser) {
					    	if ( mongoErr ) {
					    		callback( winston.makeMongoError( mongoErr ) );

					    	} else {
									upgradeHelpers.startStripeSubscription( foundUser, function(err) {
										if ( err ) {
											callback( err );

										} else {
											//The charge succeeded, so let the user know.  Errors from here on out will just be logged.
											callback();

											upgradeHelpers.upgradeUser( foundUser, function(err) {
												if ( err ) {
													winston.handleError(err);

												} else {
											    upgradeHelpers.markUserUpgradeStatus( userUpgrade, 'success', function(err) {
											    	if ( err ) {
											    		winston.handleError(err);
											    	}
											    });
												}
											});
							    	}
							    });
								}
							});
						}
					});
				}
			});
		}
	});
}

//This function grants the user the appropriate benefits of her billingPlan (e.g. extra days)
exports.upgradeUser = function( user, callback ) {
	//TODO: write this...

}

exports.startStripeSubscription = function( user, callback ) {
	if ( ! user ) { callback( winston.makeMissingParamError('user') ); return; }
	if ( ! user.stripeCustomerId ) { callback( winston.makeMissingParamError('user.stripeCustomerId') ); return; }
	if ( ! user.stripeToken ) { callback( winston.makeMissingParamError('user.stripeToken') ); return; }
	if ( ! user.billingPlan ) { callback( winston.makeMissingParamError('user.billingPlan') ); return; }

	var stripeChargeData = {
		plan: user.billingPlan
	};

	stripe.customers.update_subscription( user.stripeCustomerId, stripeChargeData, function( err, customer ) {
		if ( err ) {
			callback( winston.makeError('stripeChargeError', {stripeError: err.message}) );

		} else {
			callback();
		}
	});
}

exports.markUserUpgradeStatus = function( userUpgrade, status, callback ) {
	if ( ! userUpgrade ) { callback( winston.makeMissingParamError('userUpgrade') ); return; }
	if ( ! userUpgrade._id ) { callback( winston.makeMissingParamError('userUpgrade._id') ); return; }
	if ( ! status ) { callback( winston.makeMissingParamError('status') ); return; }

	userUpgrade.status = status;
	var userUpgradeUpdateData = {$set: {
		status: userUpgrade.status
	}};

	UserUpgradeModel.findByIdAndUpdate( userUpgrade._id, userUpgradeUpdateData, function(mongoErr) {
		if ( mongoErr ) {
			callback( winston.makeMongoError( mongoErr ) );

		} else {
			callback();
		}
	});
}

exports.getStripeCustomerId = function( user, stripeToken, callback ) {
	if ( ! user ) { callback( winston.makeMissingParamError('user') ); return; }
	if ( ! stripeToken ) { callback( winston.makeMissingParamError('stripeToken') ); return; }

	if ( user.stripeCustomerId ) {
		callback( null, user.stripeCustomerId );

	} else {
		var stripeCustomerData = {
				email: user.email
			, card: stripeToken
			, description: utils.getFullName( user.firstName, user.lastName )
		};

		stripe.customers.create( stripeCustomerData, function( err, customer ) {
	    if ( err ) {
	       callback( winston.makeError('stripeError', {stripeError: err.message}) );

	    } else {
	    	var stripeCustomerId = customer.id;
		    winston.doInfo('stripeCustomerId', {stripeCustomerId: stripeCustomerId});
		    user.stripeCustomerId = stripeCustomerId;
		    
		    var updateData = {$set: {
		    	stripeCustomerId: stripeCustomerId
		    }};

		    UserModel.findByIdAndUpdate( user._id, updateData, function(mongoErr, updatedUser) {
		    	if ( mongoErr ) {
		    		callback( winston.makeMongoError( mongoErr ) );

		    	} else {
						callback( null, stripeCustomerId );
		    	}
		    });
			}
	 	});
	}
}
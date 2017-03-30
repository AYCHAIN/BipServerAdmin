/**
 *
 * Copyright (c) 2017 InterDigital, Inc. All Rights Reserved
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
var proto = require('./native');

function HTTPBasic(options) {
  this.options = options;
}

HTTPBasic.prototype = proto.prototype;

/*
 *  Remote HTTP Basic Auth
 */
HTTPBasic.prototype.test = function(username, password, opts, next) {
  var self = this,
    dao = this.dao,
    filter = {},
    options = this.options;

  if ('admin' === username || opts.asOwner) {
    this.__proto__._test.apply(this, arguments);

  } else if (!username || !password) {
    next(self.MSG_NOT_AUTHORIZED, null);

  } else {

    this.__proto__._test.call(this, username, password, opts, function(err, result) {
	  if (err) {
	     // try to auth and sync off ldap auth service
		  request.get(
				  {
					  "url" : options.url,
					  "auth" : {
						  "user" : username,
						  "pass" : password,
						  "sendImmediately" : true
					  }
				  },
				  function(err, res, body) {
					  if (err) {
						  next(err);
					  } else if (200 !== res.statusCode) {
						  next('Not Authorized');
					  } else {
						  dao.find(
								  'account',
								  {
									  username : username
								  },
								  function(err, acctResult) {
									  if (!err && (null != acctResult)) {

										  var filter = {
												  'owner_id' : acctResult.id,
												  'type' : 'token'
										  }

										  dao.find('account_auth', filter, function(isErr, authResult) {
											  var resultModel = null;
											  if (!isErr && null != authResult) {

												  self.acctBind(acctResult, authResult, options, function(err, accountInfo) {
													  if (err) {
														  next(err);
													  } else {
														  try {
															  accountInfo._remoteBody = JSON.parse(body);
														  } catch (e) {
															  accountInfo._remoteBody = body;
														  }
														  next(false, accountInfo);
													  }
												  });

											  } else {
												  next(self.MSG_NOT_AUTHORIZED, resultModel);
											  }
										  });

										  // if user auths off and option set, auto create
										  // local account
									  } else if (!acctResult && options.auto_sync && options.auto_sync.mail_field) {
										  var emailAddress;

										  // if no email address found, create a local dummy
										  if ('none' === options.auto_sync.mail_field) {
											  emailAddress = 'noreply@' + username + '.' + CFG.domain;
										  } else {
											  emailAddress = app.helper.jsonPath(body, options.auto_sync.mail_field);
										  }

										  if (emailAddress) {

											  dao.createUser(username, emailAddress, null, function(err, authResult) {

												  authResult.username = username;
												  authResult.name = username
												  authResult.account_level = GLOBAL.DEFS.ACCOUNT_LEVEL.USER;

												  self.acctBind(authResult, authResult, options, function(err, accountInfo) {
													  if (err) {
														  next(err);

													  } else {
														  try {
															  accountInfo._remoteBody = JSON.parse(body);
														  } catch (e) {
															  accountInfo._remoteBody = body;
														  }
														  next(false, accountInfo);
													  }
												  });

											  });

										  } else {
											  next(self.MSG_NOT_AUTHORIZED, null);
										  }
									  } else {
										  app.logmessage('No Email field found to sync for ' + username + ', skipping auth', 'error');
										  next(self.MSG_NOT_AUTHORIZED, null);
									  }
								  }
						  );
					  }
				  }
		  );
	  } else {
	     next(err, result);
	  }
	});

  }
}

module.exports = HTTPBasic;

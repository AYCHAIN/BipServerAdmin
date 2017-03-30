#!/usr/bin/env node
/*
 * Pauses bips for every user in a list
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
var Q = require('Q'),
	_ = require('underscore'),
	fs = require('fs');

// grandfathers plans
process.HEADLESS = true;
process.NOCONSUME = true;

var bootstrap = require(process.env.BIPIO_SERVER_ROOT + '/src/bootstrap'),
  dao = bootstrap.app.dao,
  orderedPlans = [];
  userFile = process.argv[2];

if (!userFile) {
	console.log('Usage - ./tools/pause_zombie.js {filename}');
	process.exit();
}

function pauseBips(email, next) {
	dao.findFilter(
		'account',
		{
			'email_account' : email
		},
		function(err, results) {
			var result;
			if (err) {
				next(err);
			} else {
				result = results.pop();
				dao.findFilter(
					'bip',
					{
						owner_id : result.id
					},
					function(err, bips) {

						if (err) {
							next(err);
						} else if (bips && bips.length) {
							var promises = [],
								deferred;

							for (var i = 0; i < bips.length; i++) {

								deferred = Q.defer();
								promises.push(deferred.promise);

								(function(bip, deferred) {
									dao.pauseBip(bip, true, function(err) {
										if (err) {
											deferred.reject(err);
										} else {
											deferred.resolve(bip);
										}
									})
								})(bips[i], deferred);
							}

							Q.all(promises).then(
								function() {
									next(false, _.pluck(arguments[0], 'id') );
								},
								function(err) {
									next(err);
								}
							);

						} else {
							next();
						}
					}
				);
				next(false, result);
			}
		}
	);
}

dao.on('ready', function(dao) {
	var emails = fs.readFileSync(userFile).toString().split('\n'),
		count = 0;

	for (var i = 0; i < emails.length; i++) {
		if (emails[i]) {

			(function(email) {
				pauseBips(emails[i], function(err, result) {

					count++;
					console.log("PAUSING " + email, result && _.isArray(result) ? result.join(',') : "NONE");

//					process.exit();
				});
			})(emails[i]);

		} else {
			count++;
		}

	}
});

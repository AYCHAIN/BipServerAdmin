#!/usr/bin/env node
/*
 * Grandfathers users on 'user' plans into whatever tier their current usage implies.
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
	_ = require('underscore');

// grandfathers plans
process.HEADLESS = true;
process.NOCONSUME = true;

var bootstrap = require(__dirname + '/../src/bootstrap'),
  dao = bootstrap.app.dao,
	dryRun = ('dryrun' == process.argv[2]);

function exit(args) {
	console.error(args);
	process.exit(0);
}

if (bootstrap.app.modules.permissions) {

	dao.on('ready', function(dao) {

		// get users
		dao.findFilter('account', {}, function(err, results) {
			var account, promise, count, done = 0;

			if (err) {
				exit(arguments);
			} else {
				count = results.length;

				for (var i = 0; i < results.length; i++) {
					account = results[i];
					// only set 'user' accounts
					if ('user' === account.account_level) {

						bootstrap.app.modules.permissions.fetchPlan(account).then(
							function(struct) {

								if (dryRun) {
									done++;

									if (done >= count) {
									  exit('OK - DID NOTHING, THIS IS A DRY RUN');
									}

								} else {

									console.log(struct.plan.reason.join('\n'));

									dao.updateColumn(
										'account',
										{
											id : struct.account.id
										},
										{
											account_level : struct.plan.id
										},
										function(err, result) {
											if (err) {
												console.error(arguments);
												process.exit(0);
											} else {
												done++;
												if (done >= count) {
													exit('OK');
												}
											}
										}
									);
								}
							},
							function() {
								exit(arguments);
							}
						);

					} else {
						count--;
					}
				}

//				console.log(arguments)
			}
		});

	});
} else {
	console.error('No Permissions Module Available');
}

/*
 * A cron based drip events extension for the stats module
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
var cron = require('cron'),
  events = require('events'),
  eventEmitter = new events.EventEmitter(),
	_ = require('underscore');

function DripEvents(statModule) {
	var self = this,
		dailyJob = new cron.CronJob(
		statModule.options.drip.cron,
		function() {
			var start1D = moment().subtract(1, 'day').startOf('day').valueOf(),
				end1D = moment().subtract(1, 'day').endOf('day').valueOf();

			// users that signed up yesterday
			statModule.recentUsers(
				function(err, result) {
					if (!err && result && result.stat && result.stat.length) {
						_.each(result.stat, function(stat) {
							// if no bips created
							if (!stat.total) {
								self.emit('drip', '1d_no_bips', stat );
							}
						})
					}
				},
				start1D,
				end1D
			);
		},
		null,
		true
	);
}

DripEvents.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = DripEvents;

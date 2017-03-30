/**
 *
 * The Bipio API Server contrib module for retrieving stats. Needs admin privileges
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
 *
 */

// Model overrides
var _ = require('underscore'),
	Q = require('q'),
	PermissionedChannelModel = require('./models/channel.js');

function PermissionsModule(options) {
	this.options = options;
	this._plans = options.plans;
}

PermissionsModule.prototype = {
	_plans : {},
	podAvailable : function(accountInfo, podName) {
		return (-1 === this._plans[accountInfo.user.account_level].pod_exclusions.indexOf(podName))
	},
	_resolvePlan : function(deferred, struct) {
	  var planName = 'user',
	  	dao = this.dao,
	  	orderedPlans = this._getOrderdPlans(),
	    plans = this._plans,
	    planId,
	    planIdx = orderedPlans.indexOf('user'),
	    bipModels = [],
	    schedule,
	    bipModel,
	    plan = {
	      id : struct.account.account_level,
	      reason : []
	    }

	  // we only care what bips are active right now, not which channels
	  // have been created.
	  for (var i = 0; i < struct.bips.length; i++) {
	    bipModel = dao.modelFactory('bip', struct.bips[i]);
	    bipModel._createChannelIndex();
	    bipModels.push(bipModel);
	  }

	  //
	  for (var idx = 0; idx < orderedPlans.length; idx++) {

	    planId = orderedPlans[idx];

	    var cids = _.flatten(_.pluck(bipModels, '_channel_idx')),
	      schedules = _.flatten(_.pluck(bipModels, 'schedule') ),
	      channel,
	      cid, pod;

	    // if using a schedule which is not the user schedule, bump to next plan
	    for (var s = 0; s < schedules.length; s++) {
	      schedule = schedules[s];
	      if (
	        schedule
	        && schedule.recurrencePattern

	        && plans[ planId].schedule
	        && plans[ planId].schedule.recurrencePattern

	        && schedule.recurrencePattern !== plans[ planId].schedule.recurrencePattern ) {

	          planIdx = (idx + 1 >= planIdx) ? idx + 1 : planIdx;

	        plan.reason.push(
	          'schedule ' +  schedule.recurrencePattern
	        );
	      }
	    }

	    // if using excluded pods, bump to lowest next plan
	    for (var i = 0; i < cids.length; i++) {
	      cid = cids[i];

	      if (app.helper.getRegUUID().test(cid) ) {
	      	channel = _.findWhere(struct.channels, { id : cid }),
	        pod = channel ? channel.action : cid;

	      } else {
	        pod = cid;
	      }

	      if (pod) {
	        pod = cid.split('.')[0];

	        if (-1 !== plans[ planId ].pod_exclusions.indexOf(pod) ) {

	          planIdx = (idx + 1 >= planIdx) ? idx + 1 : planIdx;

	          plan.reason.push('pod ' + pod.toUpperCase());
	        }
	      }
	    }

	    // if using # bips, bump to lowest supporting bip plan
	    if (struct.bips.length >= plans[ planId ].num_bips ) {

	      planIdx = (idx >= planIdx) ? idx : planIdx;

	      plan.reason.push(
	        struct.bips.length + ' >= ' + plans[ planId ].num_bips + ' bips');
	    }
	  }

	  plan.id = orderedPlans[planIdx];

	  plan.reason = _.uniq(plan.reason);

	  deferred.resolve({
	    account : struct.account,
	    plan : plan
	  });
	},

	fetchPlan : function(account) {
		var deferred = Q.defer(),
			self = this,
			dao = this.dao;

		dao.findFilter(
			'bip',
			{
				owner_id : account.id
			},
			function(err, bips) {
				if (err) {
					deferred.reject();
				} else {

					dao.findFilter(
						'channel',
						{
							owner_id : account.id
						},
						function(err, channels) {
							if (err) {
								deferred.reject();
							} else {

								self._resolvePlan(
									deferred,
									{
										account : account,
										bips : bips,
										channels : channels
									}
								);

							}
						}
					);

				}
			}
		);

		return deferred.promise;
	},

	_getOrderdPlans : function() {
		var self = this;
		// # of bips is the most basic upgrade metric
		var orderedPlans = _.sortBy(
			Object.keys(this._plans),
			function(plan) {
				return self._plans[plan].num_bips;
			}
		);

		// remove admin
		orderedPlans.pop();

		return orderedPlans;
	},

	decorators : function() {
		var self = this,
		plans = self._plans;

		return {
			dao : {
				describe : function(model, subdomain, next, accountInfo) {
					var scope = this,
					accountLevel = accountInfo.user.account_level;

					return function(error, modelName, results, code, options) {
						if (error || 'pod' !== model || !results) {
							next.apply(scope, arguments);

						} else if ('pod' === model) {

							self.app._.each(results, function(pod, podName) {
								if (!plans[accountLevel] || !self.podAvailable(accountInfo, podName)) {
									pod.level_locked = true;
							}
						});

							next.apply(scope, arguments);

						} else {
							next.apply(scope, arguments);
						}
					}
				}
			}
		}
	},
	overrides : function() {
		var that = this;

		var triggerQueue = [],
		  triggerTimer;

		return {
			dao : {
				describe : function(model, subdomain, next, accountInfo) {
					this.__describe.call(
						this,
						model,
						subdomain,
						that.decorators().dao.describe.apply(this, arguments),
						accountInfo
						);
				},
				create : function(model, next, accountInfo, daoPostSave) {
					var self = this,
					selfArgs = arguments;
					if ('bip' === model.getEntityName() ) {
						// test # of bips for user
						this.count(
							'bip',
							{
								owner_id : accountInfo.user.id
							},
							function(err, count) {
								if (err) {
									next(err, 'bip', err, 500);
								} else if (count >= that._plans[accountInfo.user.account_level].num_bips) {
									err = 'Maximum Bips Exceeded For This Plan, Please Upgrade At http://bip.io/pricing';
									next(err, 'bip', err, 402);
								} else {
									var schedule = that._plans[accountInfo.user.account_level].schedule;

									// inject plan schedule
									if (model.schedule && schedule) {
										if (model.schedule.sched) {
											model.schedule.sched.rrule = schedule.rrule;
										}

										model.schedule.recurrencePattern = schedule.recurrencePattern;
									}

									self.__create.apply(self, selfArgs);
								}
							}
							);
					} else {
						self.__create.apply(self, arguments);
					}
				},
				update : function(modelName, id, props, next, accountInfo) {
					var schedule;
					if ('bip' === modelName) {
						schedule = that._plans[accountInfo.user.account_level].schedule;
						// inject plan schedule
						if (props.schedule && schedule) {
							if (props.schedule.sched) {
								props.schedule.sched.rrule = schedule.rrule;
							}
							props.schedule.recurrencePattern = schedule.recurrencePattern;
						}
					}

					this.__update.apply(this, arguments);
				},
				patch : function(modelName, id, props, accountInfo, next) {
					var schedule;
					if ('bip' === modelName) {
						schedule = that._plans[accountInfo.user.account_level].schedule;

						// inject plan schedule
						if (props.schedule && schedule) {
							if (props.schedule.sched) {
								props.schedule.sched.rrule = schedule.rrule;
							}

							props.schedule.recurrencePattern = schedule.recurrencePattern;
						}
					}

					this.__patch.apply(this, arguments);
				},
				pod : function(podName, accountInfo) {
					var pod = this.models['channel']['class'].pod(podName);

					if (pod && accountInfo && !that.podAvailable(accountInfo, podName)) {
						pod = null;
					}

					return pod;
				},

				triggerBip : function(bip, accountInfo, isSocket, next, force) {
					var ok = true,
						self = this;

					if (accountInfo.user && accountInfo.user.plan_until) {
					  ok = (parseInt(that.app.moment().format('YYYYMDD')) < parseInt(accountInfo.user.plan_until.replace(/-/g, '')));
					}

					if (ok) {

						if (force || ( 'user' !== accountInfo.user.account_level && 'basic' !== accountInfo.user.account_level ) ) {
						  self.__triggerBip.apply(self, arguments);

						} else {
							triggerQueue.push({
								bip : bip,
								isSocket : isSocket,
								accountInfo : accountInfo
							});

							// put backpressure on user level triggers
							console.log('TRIGGER TIMER ', triggerTimer, triggerQueue.length);
				      if (!triggerTimer) {
				        triggerTimer = setInterval(function() {
				          var payload = triggerQueue.shift();
				          if (!payload) {
				            clearInterval(triggerTimer);
				            triggerTimer = null;

				          } else {
										self.__triggerBip.call(self, payload.bip, payload.accountInfo, payload.isSocket);
				          }
				        }, 1000);
				      }
						}

					} else {

						that.app.bastion.createJob(
					    DEFS.JOB_BIP_ACTIVITY, {
					      owner_id : bip.owner_id,
					      bip_id : bip.id,
					      code : 'bip_channnel_error',
					      message : "Not Running. Subscription Expired",
					      source : 'SYSTEM'
					    });

					  next();
					}
				}
			},

			bastion : {
				// intercept incoming bip unpacks (http and smtp)
				bipUnpack : function(type, name, accountInfo, client, next) {
					var ok = true;

					if (accountInfo.user && accountInfo.user.plan_until) {
						ok = (parseInt(app.moment().format('YYYYMDD')) < parseInt(accountInfo.user.plan_until.replace(/-/g, '')));
					}

					if (ok) {
						this.__bipUnpack.apply(this, arguments);

					} else {
						next("Subscription Expired");

					}
				}
			}
		}
	},

	setApp : function(app) {
		this.app = app;
	},

	_applyPrototype : function(fromModel, toModel) {
		_.each(fromModel, function(value, key) {
			if (toModel[key]) {
				toModel['__' + key] = toModel[key];
			}
			toModel[key] = value;
		});
	},

	setDAO : function(dao) {
		this.dao = dao;
	},

	routes : function(app, authWrapper) {
		var self = this,
			dao = this.dao;

		// describe plans
		app.get('/rpc/permissions/plans', function(req, res) {
			res.status(200).send(self._plans);
		});

		// drop user
		app.get('/rpc/permissions/remove_user/:id', authWrapper, function(req, res) {
			if (req.user && 'admin' === req.user.user.account_level && req.params.id) {
				dao.removeUser(
			  	req.params.id,
			    function(err, result) {
			      if (err) {
			      	res.status(500).end();
			      } else {
			      	res.status(200).end();
			      }
			    }
			  );
			} else {
				res.status(403).end();
			}
		});
	},
	initialize : function() {
		var dao = this.dao,
			bastion = this.app.bastion,
			planIds,
			self = this;
		// inject decorators only if there's plans
		if (Object.keys(this._plans).length) {
			// attach new user levels for account model validation
			if (GLOBAL.DEFS.ACCOUNT_LEVEL) {

				planIds = Object.keys(this._plans);

				if (planIds.length) {

					// bind user_level keys to global account defs
					for (var i = 0; i < planIds.length; i++) {
						if (!GLOBAL.DEFS.ACCOUNT_LEVEL[planIds[i].toUpperCase()]) {
							GLOBAL.DEFS.ACCOUNT_LEVEL[planIds[i].toUpperCase()] = planIds[i];
						}
					}

					var ovrDAO = this.overrides().dao,
						ovrBST = this.overrides().bastion;

					// ------------- OVERRIDES

					// inject overrides for dao
					this.app._.each(ovrDAO, function(func, funcName) {
						dao['__' + funcName] = dao[funcName];
						dao[funcName] = func;
					})

					// inject overrides for bastion
					this.app._.each(ovrBST, function(func, funcName) {
						bastion['__' + funcName] = bastion[funcName];
						bastion[funcName] = func;
					})

					// ------------- PROTOTYPES

					// - channel
					var ChannelClass = dao.getModelClass('channel');

					PermissionedChannelModel.getPlans = function() {
						return self._plans;
					}

					this._applyPrototype(PermissionedChannelModel, ChannelClass);

					// ------------- MODELS
					var AccountClass = dao.getModelClass('account');

					// add plan_until attribute to account schema
					AccountClass.entitySchema.plan_until = {
				    type: String,
				    renderable: true,
				    writable: false
				  }

				  // re-register model
					dao.registerModelClass(AccountClass, true);
				}
			} else {
				throw new Exception('No Global Account Definitions');
			}
		}
	}
};

module.exports = PermissionsModule;

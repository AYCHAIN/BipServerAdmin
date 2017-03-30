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
 var Q = require('q'),
 moment = require('moment'),
 _ = require('underscore'),
 DripEvent = require('./drip_events');

function StatModule(options) {
  var self = this;
  this.options = options;

  if (app.isMaster && this.options.drip && this.options.drip.cron && this.options.drip.target_user_id) {
    this.drip = new DripEvent(this);
    this.drip.on('drip', function(eventName, stat) {
      // invoke http bip for configured user
      self.dao.find(
        'bip',
        {
          owner_id : self.options.drip.target_user_id,
          name : eventName,
          paused : false
        },
        function(err, bip) {
          var exports = {
            source : stat,
            _bip : bip,
            _client : {}
          }

          if (!err) {
            if (bip) {

              bip = self.dao.modelFactory('bip', bip);

              self.bipio.bastion.bipFire(
                bip,
                exports,
                exports._client,
                {},
                []
              );

            } else {
              self.bipio.logmessage('No Bip Event [' + eventName + '] Handler configured for user ' + self.options.target_user_id, 'warning');
            }
          }
        }
      );
    })
  }
}

function nowUTCMSeconds() {
  return new Date().getTime();
}

StatModule.prototype = {
  actions : function(next) {
    actionsList = [];
    this.dao.findFilter(
      'channels',
      {},
      function(err, results) {
        if (err) {
         next(err);
       } else {
        next(false, results);
      }
    }
    );
  },
  users : function(next) {
    this.dao.findFilter(
      'account_option',
      {},
      function(err, results) {
        if (err) {
          next(err);
        } else {
          next(false, results.length);
        }
      }
      );
  },

  usage: function(next, year, month, username) {
    var self = this;
    if(username && username != null) {
      self.dao.find('account',
          {
          username: username
          }, function(err,account) {
            if(err) {
              next(err);
            } else {
              if(account && account !=null) {
                self._usage(next, year, month, {id: account.id, username: account.username});
              } else {
                self._usage(next, year, month, {id: username, username: username}); //maybe system is sent
              }
        }
      });
    } else {
      self._usage(next, year, month);
    }
  },

  _usage: function(next, year, month, user) {
    var filter = [
      {
        $group: {
        "_id":{ "user": "$owner_id", "year": {$substr: ["$day", 0, 4]}, "month": {$substr: ["$day", 4, 2]}},
        inbound_mb: {$sum: "$traffic_inbound_mb"},
        outbound_mb: {$sum: "$traffic_outbound_mb"}
        }
        },
        {
          $match: { $and: [{}] }
        },
      {
        $sort : {month: -1, user: -1}
      },
      {
        $project:
          { _id: 0,
            user: "$_id.user",
            year: "$_id.year",
            month: "$_id.month",
            inbound_mb: 1,
            outbound_mb: 1
          }
      }
    ]

    if(month && month > 0 && month < 13) {
      filter[1]["$match"]["$and"].push({"_id.month" : month});
    }

    if(year && year > 0) {
      filter[1]["$match"]["$and"].push({"_id.year" : year});
    }

    if(user && user != null && user.id) {
      filter[1]["$match"]["$and"].push({"_id.user": user.id});
    }

    var self = this;
    var statistics = [];
    var users = [];
    this.dao.aggregate(
      'stats_account',
        filter,
      function(err, results) {
            if (err) {
             next(err);
           } else {
              var deferred, promises = [];

            for (var i = 0; i < results.length; i++) {
                  deferred = Q.defer();
                  promises.push(deferred.promise);
                  (function(aggResults, idx, deferred) {
               var myResult = aggResults[i];

               if(myResult["user"] == "system") {
                 statistics.push(
                  {
                    user: "system",
                    year: myResult.year,
                    month: myResult.month,
                    inbound_mb: myResult.inbound_mb,
                    outbound_mb: myResult.outbound_mb
                  }
                );
                 deferred.resolve();
               } else if(user && user != null) {
                 statistics.push(
                  {
                    user: user.username,
                    year: myResult.year,
                    month: myResult.month,
                    inbound_mb: myResult.inbound_mb,
                    outbound_mb: myResult.outbound_mb
                  }
                );
                 deferred.resolve();
               } else {
                //CHECK if username was retrieved in another month
                 var found =  _.find(users, function(item){
                   if(item.get('id') === myResult["user"]) {
                     statistics.push(
                        {
                          user: item["name"],
                          year: myResult.year,
                          month: myResult.month,
                          inbound_mb: myResult.inbound_mb,
                          outbound_mb: myResult.outbound_mb
                        }
                      );
                     deferred.resolve();
                     return true;
                   }
                 });

                 if(!found) {
                    (function(accountId) {
                     self.dao.find(
                        'account',
                        {
                          id: accountId
                        },
                        function(err,account) {
                          if(err) {
                            deferred.reject(err);
                          } else {
                            if (!account) {
                              account = {
                                id : accountId,
                                username : "ACCOUNT REMOVED"
                              }
                            }
                            users.push({id: account.id, name: account.username});
                            statistics.push(
                              {
                                user: account.username,
                                year: myResult.year,
                                month: myResult.month,
                                inbound_mb: myResult.inbound_mb,
                                outbound_mb: myResult.outbound_mb
                              }
                            );
                          deferred.resolve();
                        }
                      });
                    })(aggResults[i]["user"]);
                  }
                }

               })(results,i, deferred)
            }

            if (promises.length) {
                  Q.all(promises).then(function() {
                    next(false, _.sortBy(statistics, 'month').reverse());
                  },
                    function() {
                       next(false, {});
                     });
                 } else {
                   next(false, {});
                 }
          }
        }
    );



  },
  returningUsers : function(next, fromUnix, toUnix, days) { //days defaults to 1
    var self = this,
    now = Math.floor(nowUTCMSeconds() / 1000),

    then =  now - (60 * 60 * 24 * days);

    var filter = {};

     if ((undefined === fromUnix || 0 === fromUnix) && (undefined === toUnix || 0 === toUnix)) {
        filter.last_session = {
          '$gt' : then
        };
      } else {
          //
          if (fromUnix  && fromUnix > 0) {
            filter.last_session = {
              '$gt' : fromUnix
            };
          }

          if (toUnix  && toUnix > 0) {
            if (!filter.last_session) {
              filter.last_session = {};
            }

            filter.last_session['$lt'] = toUnix;
          }
        }


    this.dao.findFilter(
      'account',
      filter,
      function(err, results) {
        var defer, promises = [];

        if (err) {
          next(err);
        } else {
          next(
            false,
            {
              count : results.length,
            users: _.pluck(results, 'username'),
              since : (fromUnix  && fromUnix > 0) ? fromUnix : ((toUnix && toUnix > 0) ? "ever": then),
              now : (toUnix  && toUnix > 0) ? toUnix : now
            })
        }
      },
      { username: 1, _id: 0 }
      );
  },

  leadUsers : function(next) {
    var self = this,
    leaderboard = [];

    this.dao.aggregate(
      'bip',
      [
      {
        $group : {
          '_id' : "$owner_id",
          'bips' : {
            $push : {
              name : "$name",
              type : "$type",
              paused : "$paused",
              _last_run : "$_last_run",
              _channel_idx : "$_channel_idx"
            }
          },
          'count' : {
            $sum : 1
          }
        }
      }
      ],
      function(err, results) {
        if (err) {
          next(err);
        } else {
          for (var i = 0; i < results.length; i++) {
            (function(aggResults, idx) {
              var channels = _.uniq(_.flatten(_.pluck(aggResults[idx].bips, '_channel_idx')));

              if (channels && channels.length) {
                // get channels
                self.dao.findFilter(
                  'channel',
                  {
                    owner_id : aggResults[idx]._id,
                    id : {
                      $in : channels
                    }
                  },
                  function(err, channelResults) {
                    if (err) {
                      next(err);
                    } else {
                      var manifest = [];
                      _.each(channelResults, function(result) {
                        manifest.push(result.action)
                      });
                      manifest = _.uniq(manifest).sort();

                      aggResults[idx].actions = manifest;

                      // get account
                      self.dao.find('account', { id : aggResults[idx]._id }, function(err, result) {
                        if (err) {
                          next(err);
                        } else {

                          if (result) {
                            aggResults[idx].username = result.username;
                            aggResults[idx].name = result.name;
                            aggResults[idx].email_account = result.email_account;
                          } else {
                            aggResults[idx].username = '__DEFUNCT__';
                          }

                          leaderboard.push(aggResults[idx]);

                          if (idx >= results.length - 1) {
                            next(false, _.sortBy(leaderboard, 'count').reverse() );
                          }
                        }
                      });
                    }
                  }
                  );
              } else {
                // get account
                self.dao.find('account', { id : aggResults[idx]._id }, function(err, result) {
                  if (err) {
                    next(err);
                  } else {

                    if (result) {
                      aggResults[idx].username = result.username;
                      aggResults[idx].name = result.name;
                      aggResults[idx].email_account = result.email_account;
                    } else {
                      aggResults[idx].username = '__DEFUNCT__';
                    }

                    leaderboard.push(aggResults[idx]);

                    if (idx >= results.length - 1) {
                      next(false, _.sortBy(leaderboard, 'count').reverse() );
                    }
                  }
                });
              }
            })(results, i);
          }
        }
      });
    },


    podUsers: function(next, pod) {
      var self = this;
      var pods = {};
      this.dao.aggregate('bip',
        [
             { $group : {
               "_id" :"$owner_id",
               _channel_idx :  { "$push" : "$_channel_idx"}
               }
             },
             { "$unwind": "$_channel_idx" },
             { "$unwind": "$_channel_idx" },
             // Now use $addToSet to get the distinct values
             { "$group": {
                 "_id": "$_id",
                 "_channel_idx": { "$addToSet": "$_channel_idx" }
             }}

        ],function(err, results) {
        if (err) {
                next(err);
              } else {
                var deferred, promises = [];
                for (var i = 0; i < results.length; i++) {
                  deferred = Q.defer();
                      promises.push(deferred.promise);
                      (function(aggResults, idx, deferred) {
                        var channels = aggResults[idx]["_channel_idx"];
                        var owner_id =  aggResults[idx]["_id"];
                        self.dao.find('account',
                        {
                          id: owner_id
                        }, function(err,account) {
                          if(err) {
                            deferred.reject(err);
                          } else {
                            var deferred2, promises2 = [];
                            for(var j = 0; j < channels.length; j++) {
                            deferred2 = Q.defer();
                                  promises2.push(deferred2.promise);
                                 (function(channel, account, deferred2) {
                                  if(!app.helper.regUUID.test(channel)) {
                                    var currPod = channel.split('.')[0].trim().toLowerCase();
                                    if(pods[currPod] && !_.contains(pods[currPod]["users"], account.username)) {
                                     pods[currPod]["count"] = pods[currPod]["count"] + 1;
                                     pods[currPod]["users"].push(account.username);
                                    } else {
                                     pods[currPod] = {count: 1, users: [account.username]};
                                    }
                                    deferred2.resolve();
                                  } else {
                                    self.dao.find('channel',
                                        {
                                          id: channel,
                                          owner_id: owner_id
                                        }, function(err,results) {
                                          if(err) {
                                            deferred2.reject(err);
                                          } else {
                                            var currPod = results.action.split('.')[0].trim().toLowerCase();
                                            if(pods[currPod] && !_.contains(pods[currPod]["users"], account.username)) {
                                           pods[currPod]["count"] = pods[currPod]["count"] + 1;
                                           pods[currPod]["users"].push(account.username);
                                          } else {
                                           pods[currPod] = {"count": 1, "users": [ account.username ]};
                                          }
                                            deferred2.resolve();
                                          }
                                        }
                                        );
                                  }
                                })(channels[j], account, deferred2);
                                }
                  if (promises2.length) {
                              Q.all(promises2).then(function() {
                                deferred.resolve();
                              },
                                function(err) {
                                deferred.reject(err);
                                });
                               } else {
                                 deferred.resolve();
                               }
                          }
                        }
                        );
                      })(results, i, deferred);
                  }
                if (promises.length) {
                  Q.all(promises).then(function() {
                    if(pod) {
                      next(false, pods[pod]);
                    } else {
                      next(false, pods);
                    }
                  },
                     function() {
                       next(false, {count: 0, users: []});
                     });
                 } else {
                   next(false, {count: 0, users: []});
                 }
              }
        }
      );

      },

    recentUsers : function(next, fromUnix, toUnix, planparams) {
      var self = this,
      now = Math.floor(nowUTCMSeconds() / 1000),
      then = now - (60 * 60 * 24),
      filter = {};

      if (undefined === fromUnix && undefined === toUnix) {
        filter.created = {
          '$gt' : then
        };
      } else {
          //
          if (fromUnix  && fromUnix > 0) {
            filter.created = {
              '$gt' : fromUnix
            };
          }

          //
          if (toUnix  && toUnix > 0) {
            if (!filter.created) {
              filter.created = {};
            }

            filter.created['$lt'] = toUnix;
          }
        }

        this.dao.findFilter(
          'account',
          filter,
          function(err, results) {
            var defer, promises = [];
            var now = app.moment.utc();
            var created;

            if (err) {
              next(err);
            } else {

              if (results.length) {
                for (var i = 0; i < results.length; i++) {
                  defer = Q.defer();
                  promises.push(defer.promise);

                  (function(account, defer) {
                    self.dao.list('bip', undefined, 1, 1, [ 'created', 'asc' ], { owner_id : account.id }, function(err, modelName, results) {

                      if (account.created) {
                        created = moment(account.created < 1000000000000 ? account.created * 1000 : account.created).format('YYYYMMDD');
                      } else {
                        created = 0;
                      }

                      var struct = {
                        account : {
                          id : account.id,
                          name : account.name,
                          username : account.username,
                          email_account : account.email_account,
                          last_session : account.last_session,
                          account_level : account.account_level,
                          last_session_pretty :
                            account.last_session
                            ? app.moment.duration(now.diff(account.last_session * 1000)).humanize() + ' ago'
                            : 'Never'
                        },
                        total : 0,
                        acct_diff_seconds : 0,
                        created_day : created,
                        ttfb : 0, // time to first bip (seconds)
                        plan_params : {}
                      };

                      if (err) {
                        defer.reject(err);
                      } else {
                        struct.total = results.total;
                        struct.acct_diff_seconds = now - account.created;

                        if (results.data && results.data.length) {
                          struct.ttfb = Math.floor( (results.data[0].created / 1000) - account.created);
                        }

                        // if requestion plan parameters, then decorate
                        // from permissions module if it exists
                        if (planparams && app.modules.permissions) {

                          app.modules.permissions.fetchPlan(account).then(
                            function(planResult) {
                              struct.plan_params = planResult.plan;

                              defer.resolve(struct);
                            },
                            function() {
                              defer.resolve(struct);
                            }
                          );

                        // otherwise just resolve the promise
                        } else {
                          defer.resolve(struct);

                        }
                      }
                    });
                })(results[i], defer);
              }

              Q.all(promises).then(
                function(structs) {
                  var
                  ttfbTotal = 0
                  ttfbDivisor = 0;

                  for (var i = 0; i < structs.length; i++) {
                    if (structs[i].ttfb) {
                      ttfbTotal += structs[i].ttfb;
                      ttfbDivisor++;
                    }
                  }

                  next(
                    false,
                    {
                      now : now,
                      since : then,
                      count : structs.length,
                      ttfb_avg : ttfbDivisor ? ttfbTotal / ttfbDivisor : 0,
                      ttfb_pct : structs.length ? ttfbDivisor / structs.length : 0,
                      stat : structs
                    }
                  );
                },
                function(err) {
                  next(err);
                }
              );
            } else {
              next(err, {});
            }
          }
        }
      );
    },
    bips : function(next) {
      this.dao.findFilter(
        'bip',
        {},
        function(err, results) {
          if (err) {
            next(err);
          } else {
            next(false, results.length);
          }
        }
        );
    },
    // @todo - created timestamp resolution mismatch? ms or seconds?
    recentBips : function(next, fromUnix, toUnix) {
      var self = this,
      now = nowUTCMSeconds(),
      then = now - (60 * 60 * 24 * 1000),
      filter = {},
      dayGroup = false;

      if (undefined === fromUnix && undefined === toUnix) {
        filter.created = {
          '$gt' : then
        };
      } else {
        //
        if (fromUnix  && fromUnix > 0) {
          filter.created = {
            '$gt' : fromUnix
          };
        }

        //
        if (toUnix  && toUnix > 0) {
          if (!filter.created) {
            filter.created = {};
          }

          filter.created['$lt'] = toUnix;
        }
        dayGroup = true;
      }

      this.dao.findFilter(
        'bip',
        filter,
        function(err, results) {
          if (err) {
            next(err);
          } else {
            var dayResults = {}, bipDate;
            if (dayGroup) {
              for (var i = 0; i < results.length; i++) {
                bipDate = moment(results[i].created).format('YYYYMMDD');
                if (!dayResults[bipDate]) {
                  dayResults[bipDate] = 0;
                }
                dayResults[bipDate]++;
              }
              next(false, dayResults);
            } else {
              next(false, results.length);
            }
          }
        }
        );
    },
    createdBips : function(next) {
      var self = this,
        filter = [
          {
            $group : {
              '_id' : "$day",
              'bips_total' : {
                $sum : "$bips_total"
              },
              'share_total' : {
                $sum : "$share_total"
              },
              'channels_total' : {
                $sum : "$channels_total"
              }
            }
          }
        ];

      this.dao.aggregate(
        'stats_account',
        filter,
        function(err, results) {
          next(err, results);
        }
      );
    },
    _runningBips : function(next) {
      var self = this;

      self.dao.list('bip_log', undefined, 0, 1, [ 'day', 'asc' ], { code : 'bip_invoke'}, function(err, modelName, results) {

        if (err) {
          next(err);
        } else {
          var stats = {},
            r;

          for (var i = 0; i < results.data.length; i++) {
            r = results.data[i];
            var day = moment(r.created).format('YYYYMMDD');

            if (!stats[day]) {
              stats[day] = 0
            }

            _.each(r.data, function(value, ptr) {
              var src = ptr.split(';').shift(),
                tokens = src.split('#'),
                pod;

              stats[day]++;
            });

          }
          next(false, stats);
        }
      });
    },
    runningBips : function(next, dayStart, dayEnd) {
      var self = this,
        filter = {};

      if (dayStart) {
        filter['updated'] = {
          "$gt" : dayStart
        }
      }

      if (dayEnd) {
        if (!filter['updated']) {
          filter['updated'] = {};
        }

        filter['updated']['$lt'] = dayEnd;
      }

      self.dao.list('stats_account_network', undefined, 1000000, 1, [ 'day', 'asc' ], filter, function(err, modelName, results) {

        if (err) {
          next(err);
        } else {
          var stats = {},
            r;

          for (var i = 0; i < results.data.length; i++) {
            r = results.data[i];

            if (!stats[r.day]) {
              stats[r.day] = {
                src : 0,
                edges : 0
              }
            }

            _.each(r.data, function(value, ptr) {
              var src = ptr.split(';').shift(),
                tokens = src.split('#'),
                pod;

              if (0 === src.indexOf('bip') ) {
                stats[r.day].src += value;
              } else {
                pod = self.dao.pod(tokens[0]);
                if ('invoke' !== pod.getAction(tokens[1]).trigger ) {
                  stats[r.day].src += value;
                }
              }

              stats[r.day].edges += value
            });

          }
          next(false, stats);
        }
      });
    },
    avgRunningBips : function(next, fromUnix, toUnix) {
      var self = this,
      now = Math.floor(nowUTCMSeconds() / 1000),
      then = now - (60 * 60 * 24),
      filter = {
          code : 'bip_invoke'
        };

      if (undefined === fromUnix && undefined === toUnix) {
        filter.created = {
          '$gt' : then
        };
      } else {
        //
        if (fromUnix  && fromUnix > 0) {
          filter.created = {
            '$gt' : fromUnix* 1000
          };
        }

        //
        if (toUnix  && toUnix > 0) {
          if (!filter.created) {
            filter.created = {};
          }

          filter.created['$lt'] = toUnix * 1000;
        }
      }

      self.dao.findFilter('bip_log', filter, function(err, results) {
        if (err) {
          next(err);
        } else {
          var avgs = {}, r, day, dailyAvg = 0;
          for (var i = 0; i < results.length; i++) {
            r = results[i];
            day = moment(r.created).format('YYYYMMDD');
            if (!avgs[day]) {
              avgs[day] = [];
            }
            if (r.bip_id) {
              avgs[day].push(r.bip_id);
            }
          }
          for (var k in avgs) {
            dailyAvg += app._.uniq(avgs[k]).length;
          }

          dailyAvg = Math.ceil(dailyAvg / Object.keys(avgs).length);
          next(false, { avg : dailyAvg});
        }
      });
    },

    runningBipsDistinct : function(next, fromUnix, toUnix) {
      var self = this,
      now = Math.floor(nowUTCMSeconds() / 1000),
      then = now - (60 * 60 * 24),
      filter = {
          code : 'bip_invoke'
        };

      if (undefined === fromUnix && undefined === toUnix) {
        filter.created = {
          '$gt' : then
        };
      } else {
        //
        if (fromUnix  && fromUnix > 0) {
          filter.created = {
            '$gt' : fromUnix* 1000
          };
        }

        //
        if (toUnix  && toUnix > 0) {
          if (!filter.created) {
            filter.created = {};
          }

          filter.created['$lt'] = toUnix * 1000;
        }
      }

      self.dao.findDistinct('bip_log', filter, 'bip_id', function(err, results) {
        if (err) {
          next(err);
        } else {
          console.log(results);

          next(false, { distinct : results });
        }
      });
    },

    setApp : function(app) {
      this.bipio = app;
    },

    setDAO : function(dao) {
      this.dao = dao;
    },
    _respond : function(stat, res) {
      return function(err, result) {
        if (err) {
          res.status(500).send(err);
        } else {
          var resp = {};
          resp[stat] = result;
          res.status(200).send(resp);
        }
      }
    },
    _notFound : function(res) {
      res.status(404).end();
    },
    routes : function(app, authWrapper) {
      var self = this;
      app.get('/rpc/stats/:stat/:mode?', authWrapper, function(req, res) {
        if (req.user && 'admin' === req.user.user.account_level && req.params.stat) {
          switch (req.params.stat) {
            case 'pods' :
              if (req.params.mode) {
                 if ('users' === req.params.mode) {
                   self.podUsers(self._respond(req.params.stat, res), req.query.pod);
                 }
              }
                break;
            case 'users' :
              if (req.params.mode) {
                  // recent signup stats
                  if ('recent' === req.params.mode) {
                    self.recentUsers(self._respond(req.params.stat, res), req.query.fromUnix || 0, req.query.toUnix || 0, req.query.planparams);

                  } else if ('all' === req.params.mode) {
                    self.recentUsers(self._respond(req.params.stat, res), req.query.fromUnix || 0, req.query.toUnix || 0), req.query.planparams;
                  // returning users stats
                } else if ('returning' === req.params.mode) {
                  self.returningUsers(self._respond(req.params.stat, res), req.query.fromUnix || 0, req.query.toUnix || 0, req.query.days || 1);

                } else if ('leaderboard' === req.params.mode) {
                  self.leadUsers(self._respond(req.params.stat, res));
                } else if ('usage' === req.params.mode) {
                    self.usage(self._respond(req.params.stat, res), req.query.year, req.query.month, req.query.user);
               }else {
                  self._notFound(res);
                }
              } else {
                self.users(self._respond(req.params.stat, res));
              }
              break;

           case 'actions' :
              self.actions(self._respond(req.params.stat, res));
              break;

          case 'bips' :
            if (req.params.mode) {
              if ('recent' === req.params.mode) {
                self.recentBips(self._respond(req.params.stat, res));

              } else if ('all' === req.params.mode) {
                self.recentBips(self._respond(req.params.stat, res), req.query.fromUnix || 0, req.query.toUnix || 0);

              } else if ('created' === req.params.mode) {
                self.createdBips(self._respond(req.params.stat, res));

              } else if ('running' === req.params.mode) {
                self.runningBips(self._respond(req.params.stat, res), req.query.dayStart || 0, req.query.dayEnd || 0);

              } else if ('distinct_running' === req.params.mode) {
                self.runningBipsDistinct(self._respond(req.params.stat, res), req.query.fromUnix || 0, req.query.toUnix || 0);

              } else if ('avgrunning' === req.params.mode) {
                self.avgRunningBips(self._respond(req.params.stat, res), req.query.fromUnix || 0, req.query.toUnix || 0);

              } else {
                self._notFound(res);
              }
            } else {
              self.bips(self._respond(req.params.stat, res));
            }
            break;
          default :
            self._notFound(res);
          }
        } else {
          res.status(403).end();
        }
      });
  }
};

module.exports = StatModule;

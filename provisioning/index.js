/**
 *
 * bipifex needs to be able to provision users over the bus by calling bipio server (API) .
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
 var request = require('request');

 function ProvisioningModule(options) {

  this.options = options;
}

function nowUTCMSeconds() {
  return new Date().getTime();
}

ProvisioningModule.prototype = {
  users : function(next) {
    next(false, nowUTCMSeconds());
  },
  setDAO : function(dao) {
    this.dao = dao;
    dao.models.domain.class.isLocal = function() {
      return true;
    }
  },

  setApp : function(app) {
    this._bipio = app;
  },

  _callWorkflow : function(payload) {
    var opts = {
        json : payload
      },
      self = this,
      wf = this.options ? this.options.onboard : null;

    if (wf && wf.url) {
      if (wf.username) {
        opts.auth = opts.auth || {};
        opts.auth.username = wf.username
      }

      if (wf.password) {
        opts.auth = opts.auth || {};
       opts.auth.password = wf.password
      }

      if (opts.auth && (opts.auth.username || opts.auth.password)) {
        opts.auth.sendImmediately = true;
      }

      request.post(
        wf.url,
        opts,
        function(err) {
          if (err) {
            self._bipio.logmessage('PROVISIONING:WORKFLOW:' + err, 'error');
          }
        }
      );
    }
  },

  createUser:function(username, email, password, next){
    var self = this;

    this.dao.createUser(
      username,
      email,
      password,
      function(err, accountInfo, accountLevel) {
        if (err) {
          next(err);
        } else {
          var accountId = accountInfo.owner_id;

          // the server only provisions an API token, not a primary login as used by the UI
          // so we have to massage these records a little.

          // regenerate token
          self.dao.regenToken(accountId, function(err, token) {
            if (err) {
              self.dao.removeUser(accountId, function(rmErr) {
                next(err);
              });
            } else {

              // create 'login_primary', using the supplied password
              var accountAuth = self.dao.modelFactory(
                'account_auth',
                {
                  username : username,
                  password : password,
                  type : 'login_primary',
                  owner_id : accountId
                });

              self.dao.create(accountAuth, function(err, modelName, accountResult) {
                var url, client;
                if (err) {
                  // rollback user
                  self.dao.removeUser(accountId, function(rmErr) {
                    next(err);
                  });
                } else {
                  var payload = {
                    id : accountId,
                    username : username,
                    email : email,
                    password : password,
                    token : token,
                    account_level : accountLevel
                  };

                  next(false, payload);

                  self._callWorkflow(payload);
                }
              });
            }
          });
        }
      });
  },
  checkUsername:function(username, next){
    this.dao.checkUsername(username ,function(err,result) {
      if (err) {
        next(err);
      } else {
        if (result) {
          next();
        } else {
          next("invalid user");
        }
      }
    });
  },

  getUser : function(username, next) {
    var dao = this.dao,
      filter = {
        $or : [
          {
            username : username
          },
          {
            email_account : username
          }
        ]
      }

    dao.find(
      'account',
      filter,
      function(err, result) {
        if (err) {
          next(err);
        } else if (!result) {
          next('Not Found');
        } else {
          // get bip names
          var accountId = result.id,
            payload = {
              id : accountId,
              name : result.name,
              username : result.username,
              token : '',
              email_account : result.email_account,
              account_level : result.account_level,
              bips : []
            };

          var modelName = 'account_auth';

          // get API token
          dao.find(
            modelName,
            {
              owner_id : accountId,
              type : 'token'
            },
            function(err, result) {
              if (err) {
                next(err);
              } else if (!result) {
                next('No Token For Account');
              } else {
                payload.token = dao.modelFactory(modelName, result).getPassword()

                dao.findFilter(
                  'bip',
                  {
                    owner_id : accountId
                  },
                  function(err, results) {
                    if (err) {
                      next(err);
                    } else {
                      for (var i = 0; i < results.length; i++) {
                        payload.bips.push(results[i].name);
                      }
                      next(false, payload);
                    }
                  },
                  {
                    name : 1
                  }
                );
              }
            }
          );
        }
      }
    );
  },

  _respond : function(provisioning, res) {
    return function(err, result) {
      if (err) {
        res.status(500).send({
          message : err
        });
      } else {
        var resp = {};
        resp[provisioning] = result;
        res.status(200).send(resp);
      }
    }
  },
  _notFound : function(res) {
    res.status(404).end();
  },
  routes : function(app, authWrapper) {
    var self = this;
    app.get('/rpc/provisioning/:action/:username/:email?/:password?', authWrapper, function(req, res) {
      if (req.user && 'admin' === req.user.user.account_level && req.params.action) {
        switch (req.params.action) {
          case 'user' :
            self.getUser(req.params.username, self._respond(req.params.action, res));
            break;
          case 'signup':
            self.createUser(req.params.username, req.params.email, req.params.password, self._respond(req.params.action, res));
            break;

          case 'checkun':
            self.checkUsername(req.params.username, self._respond(req.params.action, res));
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

module.exports = ProvisioningModule;

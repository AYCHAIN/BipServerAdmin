/**
 *
 * Mozu Pod Bridge, derives an owner id for a supplied tenant
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
 function MozuModule(options) {
  this.options = options;
}

MozuModule.prototype = {
  routes : function(express, authWrapper, app) {
    var self = this;
    express.post('/rpc/partners/mozu/bridge', function(req, res) {
      var tenantId = req.headers['x-vol-tenant'],
        topic = req.body.topic;

      if (tenantId && topic) {
        app.dao.findFilter(
          'account_auth',
          {
            'auth_provider' : 'mozu',
            'type' : 'issuer_token'
          },
          function(err, results) {
            if (err) {
              res.status(500).end();
            } else if (!results || !results.length) {
              res.status(404).end();
            } else {
              for (var i = 0; i < results.length; i++) {

                if (tenantId === app.helper.AESDecrypt(results[i].username, true) ) {

                  app.dao.pod('mozu').rpc(
                    topic,
                    'bridge',
                    {
                      owner_id : results[i].owner_id
                    },
                    {},
                    null,
                    req,
                    res
                  );
                }
              }
              res.status(200).end();
            }
          }
        );
      } else {
        res.status(403).end();
      }
    });
  }
};

module.exports = MozuModule;
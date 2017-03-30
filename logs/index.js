/**
 *
 * log transports
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

function LogsModule(options) {
  this.options = options;
}

LogsModule.prototype = {
  _bipio : null,

  setApp : function(app) {
    this._bipio = app;
  },

  // type oneOf transaction|server
  retrieveLogs : function(type, date, limit, res) {
    var logger = this._bipio.winston.loggers.get(type + 'Logs'),
      date = this._bipio.moment(date, 'YYYYMMDD'),
      options = {
        from : date.startOf('day').unix() * 1000,
        until : date.endOf('day').unix() * 1000,
        order : 'desc',
        name : 'server_error'
      }

    if (limit) {
      options.limit = limit;
    }

    logger.query(
      options,
      function(err, results) {
        if (err) {
          res.status(500).send(err);
        } else {
          res.status(200).send(results);
        }
      }
    );
  },

  routes : function(app, authWrapper) {
    var self = this;
    app.get('/rpc/logs/:type/:date/:limit?', authWrapper, function(req, res) {
      if (req.user && 'admin' === req.user.user.account_level && req.params.type && req.params.date) {

        self.retrieveLogs(
          req.params.type,
          req.params.date,
          req.params.limit,
          res
        );

      } else {
        res.status(403).end();
      }
    });
  }
};

module.exports = LogsModule;

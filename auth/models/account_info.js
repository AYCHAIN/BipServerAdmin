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
function AccountInfo(account, dao) {
  this.user = account;
  this.dao = dao;

  this.collections = {};
  this.activeDomain = null;
}

AccountInfo.prototype = {

  _load : function(collection, next) {
    var self = this;

    if (!this.collections[collection]) {
      this.dao.findFilter(
        collection,
        {
          owner_id : this.user.id
        },
        function(err, result) {
          self.collections[collection] = result;
          if (next) {
            next(err, result);
          }

          return self.collections[collection];
        }
      );
    } else {

      if (next) {
        next(false, this.collections[collection]);
      }

      return this.collections[collection];
    }
  },

  getSettings : function(next) {
    var self = this;
    return this._load('account_option', function(err, settings) {

      if (app.helper.isArray(settings)) {
        self.settings = settings[0];

      } else {
        self.settings = settings;
      }

      next(err, self.settings);
    });
  },

  getSetting : function(name, next) {
    this.getSettings(function(err, settings) {
      next(err, settings[name]);
    });
  },

  getDomains : function(next) {
    return this._load('domain', next);
  },

  getDomain : function(domainId, next) {
    this.getDomains(function(err, domains) {
      next(err, _.where(domains, { id : domainId }) );
    });
  },

  testDomain : function(domainId, next) {
    this.getDomains(function(err, domains) {
      next(err, !!_.where(domains, { id : domainId}).length );
    });
  },

  getChannels : function(next) {
    this._load('channel', next);
  },

  testChannel : function(cid, next) {
    this.getChannels(function(err, channels) {
      next(err, !!_.where(channels, { id : cid}).length );
    });
  },

  getId : function() {
    return this.user.id;
  },

  getName : function() {
    return this.user.name;
  },

  getUserName : function() {
    return this.user.username;
  },

  getActiveDomain : function() {
    return this.activeDomain;
  },

  getDefaultDomain: function(next) {
    this.getDomains(
      function(err, domains) {
        next(err, _.findWhere(domains, { type : 'vanity'} ) );
      }
    );
  },

  getDefaultDomainStr : function(next) {
    this.getDefaultDomain(function(err, domain) {
      next(err, CFG.proto_public + domain.name)
    });
  },

  setActiveDomain : function(domainId, next) {
    var self = this;
    if (domainId) {
      this.getDomains(function(err, domains) {
        self.activeDomain = _.findWhere(domains, { id : domainId } );
        next();
      });
    } else {
      this.getDefaultDomain(function(err, domain) {
        self.activeDomain = domain;
        next();
      });
    }
  },

  getTimezone : function(next) {
    this.getSetting('timezone', next);
  }
};

module.exports = AccountInfo;

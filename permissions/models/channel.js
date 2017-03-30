/**
 *
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

var Channel = {};

Channel._testExclusionPlan = function(accountLevel, podName) {
  var plan = this.getPlans()[accountLevel];
  if (plan) {
    return -1 !== plan.pod_exclusions.indexOf(podName);
  }
  return false;

}

Channel.validAction = function(value) {
  value = value || this.action;

  var podName = value.split('.').shift();

  if (this.accountInfo && this._testExclusionPlan(this.accountInfo.user.account_level, podName)) {
    return false;

  } else {
    return this.__validAction.apply(this, arguments);

  }
}

Channel.getPods = function(podName, accountInfo) {
  if (accountInfo && this._testExclusionPlan(accountInfo.user.account_level, podName) ) {
    return null;

  } else {
    return this.__getPods.apply(this, arguments);

  }
}

Channel.pod = function(podName, accountInfo) {
  if (accountInfo && this._testExclusionPlan(accountInfo.user.account_level, podName) ) {
    return null;

  } else {
    return this.__pod.apply(this, arguments);

  }
}

module.exports = Channel;

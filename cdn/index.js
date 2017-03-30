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
var CDNProto = require('./src/cdn.js');
var FsProto = require('./src/fs.js');

function Fs_Cdn(options) {
	if (options && options.hasOwnProperty("provider") && options.hasOwnProperty("data_dir")) {
		this.prototype = CDNProto.prototype;
		return new CDNProto(options);
	}
	else if (options && options.hasOwnProperty("data_dir")) {
		this.prototype = FsProto.prototype;
		return new FsProto(options);
	}
	else throw new Error("Required options not specified in config.")
};

module.exports = Fs_Cdn;

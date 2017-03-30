This modules repo represents extended or admin only API's which are not publicly available through the community site.

To Install Modules from bipio-modules

`git clone git@github.com:wotio/bipio-modules`

`rsync -rav ./bipio-modules/{module name} {/path/to/bipio}/src/modules`

Add the module constructor to `{/path/to/bipio}/config/{env}.json` under the `modules` section.

Restart the server.

## License

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.


Copyright (c) 2017 InterDigital, Inc. All Rights Reserved

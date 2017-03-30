#### Logs Module

  Adds log retrieval routes for admin users.

    /rpc/logs/server/:YYYYMMDD/:n - returns last (n) server log entries for date of format YYYYMMDD
    /rpc/logs/transaction/:YYYYMMDD/:n - returns last (n) server log entries for date of format YYYYMMDD
    
#### Dependencies

bip.io v0.4.39 or above

#### Constructor

 ```
 "logs" : {
   "strategy" : "index"
 }
 ```

#### To Install Logs Module

`git clone git@github.com:wotio/bipio-modules.git`

`rsync -rav ./bipio-modules/logs {/path/to/bipio}/src/modules`

Add the module constructor to `{/path/to/bipio}/config/{env}.json` under the `modules` section.

Restart the server.

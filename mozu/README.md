#### Mozu Module

  Derives a local user from the supplied tenant id, and calls into the mozu pod 'bridge' rpc
 
    POST /rpc/partners/mozu/bridge
    
  Expected headers :
  
  Content-Type: application/json; charset=utf-8
  X-Vol-Tenant: {tenant id}

For demo purposes only for now, performs no validation or signature checking

#### Constructor

 ```
 "mozu" : {
   "strategy" : "index"
 }
 ```

#### To Install Stats Module

`git clone git@github.com:wotio/bipio-modules.git`

`rsync -rav ./bipio-modules/mozu {/path/to/bipio}/src/modules`

Add the module constructor to `{/path/to/bipio}/config/{env}.json` under the `modules` section.

Restart the server.

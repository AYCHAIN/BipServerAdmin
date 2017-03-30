#### Stats Module

  Adds statistics routes for admin users

    /rpc/stats/actions - returns # of channels

    /rpc/stats/bips - returns # of bips
    /rpc/stats/bips/all - returns engagement stats for all users (optional fromUnix and toUnix GET parameters will control creation date window)
    /rpc/stats/bips/created - returns bips and channels created per day
    /rpc/stats/bips/recent - returns # of bips created in last day
    /rpc/stats/bips/running - returns # of distinct bips and running edges per day
    /rpc/stats/bips/distinct_running - returns # of distinct bips

    /rpc/stats/users - returns # of users
    /rpc/stats/users/recent - returns engagement stats for new users in last day
    /rpc/stats/users/all - returns engagement stats for all users (optional fromUnix and toUnix GET parameters will control creation date window)
    /rpc/stats/users/returning - returns # of returning users in last day
    /rpc/stats/users/leaderboard - get leaderboard info

#### Constructor

 ```
 "stats" : {
   "strategy" : "index",
   "config" : {
     "drip" : {
     }
   }
 }
 ```

#### To Install Stats Module

`git clone git@github.com:wotio/bipio-modules.git`

`rsync -rav ./bipio-modules/stats {/path/to/bipio}/src/modules`

Add the module constructor to `{/path/to/bipio}/config/{env}.json` under the `modules` section.

Restart the server.


#### Drip Campaigns

The stats module has a daily periodic scheduler which emits drip campaign events for users matching
certain stat conditions. To enable, add the following 'config' option to the stats constructor.

##### Config

```
"config" : {
    "drip" : {
        "cron" : "0 0 3 * * *",
        "target_user_id" : "90da0a18-deeb-4905-833b-212af6e643ae"
    }
}
```

* **cron** is the cron rule for drip campaigning
* **target_user_id** is the UUID of the bipio user handling the drip campaign event.

Emitted drip events are expected to route to the bip whose name matches the event name, for the user ID specified in `config.drip.target_user_id`.  The bip must be a HTTP bip.

##### Supported Events

* **1d_no_bips** User signed up in last day, and no bips

##### Payload

The generated payload contains the same stat object as is raised by the /rpc/stats/users/recent RPC.

When configuring your bip, copy and paste this structure into the web hook parser, to get to the object attributes.

```
{ "account":
  { 
  	"id": "90da0a18-deeb-4905-833b-212af6e643ae",
    "name": "<name>",
    "username": "<username>",
    "email_account": "<email_account>",
    "last_session": 1449196189,
    "account_level": "user",
    "last_session_pretty": "5 hours ago" 
  },
  "total": 5,
  "acct_diff_seconds": 90718558,
  "created_day": "20151202",
  "ttfb": 101,
  "plan_params": {}
}
```

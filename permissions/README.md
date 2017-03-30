#### Permissions Module

  Adds overrides and route intercepts for users based on their account_level.

  This module has no UI component and simply informs UI decisions.  Copy and payment integration will need to happen to productify these plans.

  Plans can be surfaced by the UI with the RPC 

    /rpc/permissions/plans

Admin should generally be excluded from any publicly facing representation in the UI

#### Constructor

 ```
"permissions": {
    "strategy": "index",
    "config" : {
        "currency" : "usd",
        "plans" : {
            "user" : {
                "title" : "Free",
                "pod_exclusions" : [
                    "pagerduty",
                    "wotio",
                    "dropbox",
                    "evernote",
                    "trello",
                    "slack",
                    "google",
                    "email",
                    "google-drive",
                    "todoist",
                    "mailchimp",
                    "nest",
                    "openweathermap",
                    "mongodb",
                    "twilio",
                    "zoho",
                    "circonus"
                ],
                "num_bips" : 5,
                "tx_gb" : 1,
                "schedule": {
                    "recurrencePattern" : "FREQ=MINUTELY;INTERVAL=15;",
                    "rrule" : {
                        "freq": "minutely",
                        "interval": "15"
                    }
                },
                "charge" : 0
            },
            "admin" : {
                "title" : "Administrator",
                "pod_exclusions" : [],
                "num_bips" : 1000,
                "tx_gb" : 100,
                "schedule": "",
                "charge" : 0
            },
            "basic" : {
                "title" : "Basic",
                "pod_exclusions" : [],
                "num_bips" : 10,
                "tx_gb" : 5,
                "schedule": "",
                "charge" : 1000
            },
            "standard" : {
                "title" : "Standard",
                "pod_exclusions" : [],
                "num_bips" : 20,
                "tx_gb" : 10,
                "schedule": "",
                "charge" : 2500
            },
            "pro" : {
                "title" : "Professional",
                "pod_exclusions" : [],
                "num_bips" : 50,
                "tx_gb" : 100,
                "schedule": "",
                "charge" : 6000
            }
        }
    }
}
 ```

#### To Install Permissions Module

`git clone git@github.com:wotio/bipio-modules.git`

`rsync -rav ./bipio-modules/modules/permissions {/path/to/bipio}/src/modules`

Add the module constructor to `{/path/to/bipio}/config/{env}.json` under the `modules` section.

Restart the server.

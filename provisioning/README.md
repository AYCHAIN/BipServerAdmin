#### Provisioning Module

  Allows the admin user to manage user provisioning in bip.io.
  
  RPC's at a glance 

    /rpc/provisioning/checkun/:username - check for existence of username
    /rpc/provisioning/signup/:username/:email/:password - create a new user
    /rpc/provisioning/user/:username - get user info and bips.

#### Constructor

 ```
"provisioning" : {
    "strategy" : "index",
    "config" : {
        "onboard" : {
            "url" : "http://local.bip.io:5000/bip/http/user_signup",
            "username" : "username_here",
            "password" : "password_here"

        }
    }
},
 ```

#### Config

`config` is optional

##### onboard

The 'onboard' config defines the URL to POST a JSON payload to on user creation

The JSON contains :

```
{
  "id": "6d78ce5f-dbc4-4056-990b-70de6c3cd8de",
  "username": "<username>",
  "email": "<email>",
  "password": "abc132",
  "token": "abctoken123",
  "account_level": "user"
}
```

#### RPC's

All RPC's are parameterised GET requests.  Error conditions will respond with appropriate HTTP code and a message object.  eg:

```
{
  "message" : "Not Found"
}
```

###### Check For User `/rpc/provisioning/checkun/:username`

Returns 200 OK if user exists

Returns 500 if not found

###### Create User `/rpc/provisioning/signup/:username/:email/:password`

Response

```
{
    "signup": {
        "id": "6d78ce5f-dbc4-4056-990b-70de6c3cd8de",
        "username": "<username>",
        "email": "<email>",
        "password": "abc132",
        "token": "abctoken123",
        "account_level": "user"
    }
}
```

###### Get User `/rpc/provisioning/user/:username`

`:username` can be either username or email address

Response

```
{
   "user":{
      "id" : "df138cd2-ef71-46c4-9408-e6d94e39d482",
      "name" : "<name>",
      "username" : "<username>",
      "token" : "abctoken123",
      "email_account" : "<email>",
      "account_level" : "user",
      "bips" : [
         "Jz3UwBV",
         "nothing",
         "Generate a Payload",
         "user_signup"
      ]
   }
}
```

#### To Install Provisioning Module

`git clone git@github.com:wotio/bipio-modules.git`

`rsync -rav ./bipio-modules/modules/provisioning {/path/to/bipio}/src/modules`

Add the module constructor to `{/path/to/bipio}/config/{env}.json` under the `modules` section.

Restart the server.

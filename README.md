# lingdocs-backend

The backend node server app for LingDocs sites. Handles auth and various apis.

#### CouchDB

When a user upgrades their account level to `student` or `editor`:

1. A doc in the `_users` db is created with their Firebase Authentication info, account level, and a password they can use for syncing their personal wordlistdb
2. A user database is created which they use to sync their personal wordlist.  

There is also a `review-tasks` database which is used to store all the review tasks for editors and syncs with the review tasks in the app for the editor(s). 


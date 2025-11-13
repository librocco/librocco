The schema is named `init`, not `init.sql` as we need to conform to some (limiting) rules:

- while we control the way the DB schema is loaded locally
- loading the schema within the sync server is done automatically (abstracted within the `@vlcn.io/ws-server` logic):
  - while we can specify the schema directory, the name is read from the synced DB (`schame_name` in `crsqlite_master`) and validated to not include any special characters (like `.` in `.sql`)

This is as far as we could go in keeping the single schema file (avoid symlinks)

# Fixtures for script tests

This directory contains fixtures used by script tests.

## `local.ini`

This file makes it easier to start up a docker container with an ephemeral couchdb instance. It tells couchdb we're in single node mode so that a test database is set up on container creation. It also specifies credentials `admin:admin` to be used in tests.

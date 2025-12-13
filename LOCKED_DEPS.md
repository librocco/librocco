# Locked deps

This is a file listing depencencies whose versions we had to lock as they were breaking.

There are two kinds of locked deps:
1. `direct` - our direct dependencies that we had to lock for one reason or the other - should be removed (from here) once we bring them up to latest (and issues are fixed)
2. `transitive` - downsteam dependencies of one of our direct dependencies we had to explicitly so as to not cause issues with incompatible versions (to our use case) - these should be removed from here as well as respective `package.json` as soon as locking is no longer required.


## List

prettier:
  - version: ~3.4.2
  - kind: direct
  - package: web-client
  - issue: the formatting and linting (using prettier) was failing due to incompatibility with some of the svelte-related plugins

svelte:
  - version: 5.37.3
  - kind: direct
  - package: web-client
  - issue: newer versions kept failing at runtime (loading order of complex variables, e.g.: vars initialised in `#each` block with `@const` declaration passed down to `slot` components)
  - note: the version locked is not necessarily the latest one that works, but is the latest one that was intalled previously to the auto-increment (breaking the app)


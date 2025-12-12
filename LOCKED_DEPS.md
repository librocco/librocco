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
  - dependants:
    - sveltekit-superforms@3.23.1 (zod@3.24.4)
  - issue: the build was failing due to `zod` and `sveltekit-superforms` versions and our compatilibity
  - note: this is a downstream dependency and we don't need the package itself directly

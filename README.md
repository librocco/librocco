# Librocco

An offline first book store inventory management tool.

## Table of Contents

1. [Tech stack](#1-tech-stack)
2. [Monorepo management and day to day commands](#2-monorepo-management-and-day-to-day-commands):
   - [Installation](#21-installation)
   - [Day to day commands](#22-day-to-day-commands)
   - [Packages](#23-packages)
3. [CI](#3-ci):
   - [Rush in CI](#31-rush-in-ci)
4. [Additional information](#4-additional-information):
   - [Working with SVGs](#41-working-with-svg)

## 1. Tech stack

- The monorepo is managed by [Rush](https://rushjs.io)
- Client app and the UI components are written in [Svelte](https://svelte.dev) and the app is bootstrapped using [Svelte kit](https://kit.svelte.dev/)
- For presentation layer, we're using [Tailwind](https://tailwindcss.com) almost exclusively
- The packages are built and bundled with [Vite](https://vitejs.dev)
- We're using [Storybook](https://storybook.js.org/) for component preview/development
- Static typing, Linting and formatting are enforced with [TypeScript](https://www.typescriptlang.org), [ESLint](https://eslint.org) and [Prettier](https://prettier.io) respectively
- For unit tests we're using [Vitest](https://vitest.dev/)

## 2. Monorepo management and day to day commands

### 2.1. Installation

To be able to work on the repo, first you need to install pnpm and rush:

```bash
npm install -g @microsoft/rush pnpm
```

After cloning the repo, from anywhere in the project run:

```bash
rush update && rush build
```

This will install the packages, link the dependencies and `build` all of the packages (found in `/pkg/` folder).

### 2.2. Day to day commands

To add a dependency, navigate to a package in the `pkg` or `apps` directory (i.e. `cd pkg/db`) and run `rush add -p <package-name>`.To save the dependency in `devDependencies`, add `--dev` option to the `rush add` command.Additionally, the dependency can be installed by adding it manually to `package.json` and running `rush update`.To remove a dependency, remove it from `package.json` and run rush update.

To run a script, specified in `package.json`, from anywhere in the given package (containing the script), run `rushx <script>` (similar to running `npm run <script>`).

To run a repo command (available in the entire project, no matter which folder we're in), we run `rush <command>`. Those can be:

- "global" commands - ran once on the entire repo, i.e. `rush lint-staged`
- "bulk" commands - running a corresponding command from each package's `package.json`, i.e. `rush typecheck` is the same as running `rushx typecheck` in `pkg/ui`, `pkg/web`, ... see the list of our standard bulk commands in [packages](#packages) section.

To see the list of currently defined repo commands or provide new ones, check [command-line.json](./common/config/rush/command-line.json)

### 2.3. Packages

The monorepo artifacts are stored in [apps](./apps), [pkg](./pkg) and [plugins](./plugins) (depending on the use case). Each package has it's own `package.json` and a set of standard ("bulk") scripts. Standard bulk scripts:

- `build` - builds the package using Vite and TypeScript (declaration only) - used only for libs (`pkg` and `plugins`), to add efficiency to this step, the `pkg/web` app doesn't build at this step
- `lint` - lint the source code
- `lint:strict` - same as `lint`, but with `--max-warnings=0`
- `typecheck` - run typecheck on the source code (TypeScript, no emit)

_Note: all new packages need to have the same "core" bulk commands available in their package.json (even if just empty strings), else they would break the missing bulk command execution on the entire repo._

**Depending on local packages:**

If one package depends on another (local) package, it should be specified in dependencies, as `"<package-name>": "workspace:*"`.
For example, `@librocco/web-client` depends on `@librocco/db`, so `apps/web-client/package.json` contain this in it's dependencies: `"@librocco/db": "workspace:*"`.

This makes rush link the package depended upon (`@librocco/db` in this case) in the the depending package's (`@librocco/web-client` in this case) `node_modules`.

After adding a new local dependency `rush update` needs to be ran to apply the changes.

#### Apps: Web-client

This is a client web app (Svelte kit) containing the aplication logic, assembling the UI and connecting it with the backend. [see more](./apps/web-client/README.md)

To start the local dev server, run `rushx start`.

This package isn't built with the bulk `build` command (for `build` command efficiency), but rather by running `rushx build:prod`.

#### Apps: E2E

Suite of E2E tests (Paywright), stored in `apps` as it doesn't provide any exports used by other packages/apps. [see more](./apps/e2e/README.md)

#### Pkg: DB

This package contains the spec and implementations of the db interface (interfacing with Pouch/Couch DB instance(s)). [see more](./pkg/db/README.md)

#### Pkg: JS-Search

A fork of [bvaughn/js-search](https://github.com/bvaughn/js-search) (js implementation of full text search) refactored a bit for interoperability with our app. [see-more](./pkg/js-search/README.md)

#### Pkg: Scaffold

A collection of tooling config(s) used for scaffolding of each package.

#### Pkg: Shared

Package contining artifacts shared across the repo.

#### Plugins: Book data extension

A plugin used to fetch book data for easier entry for spec and installation: [see more](./plugins/book-data-extension/README.md)

## 3. CI

We're using [GitHub actions](https://docs.github.com/en/actions) for CI automation.

### 3.1. Rush in CI

We don't install Rush in the CI to avoid having root `node_modules` and `package.json` instead we're utilising Rush's `install-run-rush.js`, [read more](https://rushjs.io/pages/maintainer/enabling_ci_builds/).

Using rush this way is convenient as it will be installed and cached the first time it's ran. However, this type of usage produces annoying overhead:

- we would need to write `node common/scripts/install-run-rush.js <command>` (and rushx variant respectively), instead of running `rush <command>` each time we want to run it in CI
- our `package.json` specified scripts would not be used the same way locally and CI: locally, our scripts could run `rushx <command>`, while in the CI we would need to specify the full path (like the one above). This would require us to use different scripts for local usage and respective CI versions

To remedy this (and make our lives easier) we've created the "command proxies" for [rush](./common/scripts/rush) and [rushx](./common/scripts/rush). Both are ran using simple `rush` (and `rushx` respectively) commands, and in turn they run the corresponding `install-run-rush(x).js` passing on the arguments. We don't use this locally, but run globally installed `rush` (and `rushx`) commands. For CI, we simply need to enable the provided "command proxies" by adding them to the `PATH` variable of CI process. That is done by adding something like this in the workflow setup:

```yaml
# ...rest of the workflow setup (installing node, caching modules, etc.)
- name: Add rush directory to PATH
  run: echo "${PWD}"/common/scripts >> $GITHUB_PATH
# ...rest of the workflow code
```

This way, we don't need to worry about our scripts (or some other process' pre-deploy scripts and such) calling `rushx <command>` in the CI and are confident everything will work similarly to the way it works locally.

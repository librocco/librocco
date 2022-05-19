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
4. [](#4-additional-information):
   - [Working with SVGs](#41-working-with-svg)

## 1) Tech stack

- The monorepo is managed by [Rush](https://rushjs.io)
- Client app and the UI components are written in [React](https://reactjs.org)
- For presentation layer, we're using [Tailwind](https://tailwindcss.com) almost exclusively
- The packages are build and bundled with [Vite](https://vitejs.dev)
- We're using [Storybook](https://storybook.js.org) for component preview/development
- Static typing, Linting and formatting are enforces with [TypeScript](https://www.typescriptlang.org), [ESLint](https://eslint.org) and [Prettier](https://prettier.io) respectively
- For unit tests we're using [JEST](https://jestjs.io)

## 2) Monorepo management and day to day commands

### 2.1) Installation

To be able to work on the repo, first you need to install pnpm and rush:

```bash
npm install -g @microsoft/rush pnpm
```

After cloning the repo, from anywhere in the project run:

```bash
rush update && rush build
```

This will install the packages, link the dependencies and `build` all of the packages (found in `/pkg/` folder).

### 2.2) Day to day commands

To add a dependency, navigate to a package in the `pkg` directory (i.e. `cd pkg/web`) and run `rush add -p <package-name>`. To save the dependency in `devDependencies`, add `--dev` option to the `rush add` command. Additionally, the dependency can be installed by adding it manually to `package.json` and running `rush update`.
To remove a dependency, remove it from `package.json` and run rush update.

To run a script, specified in `package.json`, from anywhere in the given package (containing the script), run `rushx <script>` (similar to running `npm run <script>`).

To run a repo command (available in the entire project, no matter which folder we're in), we run `rush <command>`. Those can be:

- "global" commands - ran once on the entire repo, i.e. `rush lint-staged`
- "bulk" commands - running a corresponding command from each package's `package.json`, i.e. `rush typecheck` is the same as running `rushx typecheck` in `pkg/ui`, `pkg/web`, ... see the list of our standard bulk commands in [packages](#packages) section.

To see the list of currently defined repo commands or provide new ones, check [command-line.json](./common/config/rush/command-line.json)

### 2.3) Packages

All of our monorepo artifacts are stored in packages found in the [pkg](./pkg/) folder. Each package has it's own `package.json` and a set of "standard" scripts. Standard bulk scripts:

- `build` - builds the package using Vite and TypeScript (declaration only) - used only for libs, to add efficiency to this step, the `pkg/web` app doesn't build at this step
- `lint` - lint the source code
- `lint:strict` - same as `lint`, but with `--max-warnings=0`
- `typecheck` - run typecheck on the source code (TypeScript, no emit)

_Note: all new packages need to have the same "core" bulk commands available in their package.json (even if just empty strings), else they would break the missing bulk command execution on the entire repo._

**Depending on local packages:**

If one package depends on another (local) package, it should be specified in `dependencies`/`devDependencies`, as `"<package-name>": "workspace:*"`.
For example, `@librocco/web` depends on `@librocco/ui`, so `pkg/web/package.json` contain this in it's dependencies: `"@librocco/ui": "workspace:*"`.

This makes rush link the package depended upon (`@librocco/ui` in this case) in the the depending package's (`@librocco/web` in this case) `node_modules`.

After adding a new local dependency `rush update` needs to be ran to apply the canges.

#### Web

This is a client web app (React) containing the aplication logic, assembling the UI and connecting it with the backend. To start the local dev server, run `rushx start`.

This package isn't built with the bulk `build` command (for `build` command efficiency), but rather by running `rushx build:prod`

#### UI

This package contains the presentation layer components, developed as atomic React components. The development is done using Storybook (for previews) and JEST (for unit tests). To run storybook, run `rushx storybook` and to run all the unit tests, simply run `rushx test`.

**Important note: As UI package's CSS file is built by tailwind, to be able to use the styles, one needs to also import a built css file from `@librocco/ui/dist/style.css`**

## 3) CI

We're using [GitHub actions](https://docs.github.com/en/actions) for CI automation.

### 3.1) Rush in CI

We don't install Rush in the CI to avoid having root `node_modules` and `package.json` instead we're utilizing Rush's `install-run-rush.js`, [read more](https://rushjs.io/pages/maintainer/enabling_ci_builds/).

Using rush this way is convenient as it will be installed and cached the first time it has been run. However, this type of usage produces annoying overhead:

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

## 4) Additional information

### 4.1) Working with SVG

We feature multiple svg loading options for different stages:

- Storybook, with webpack uses babel and `@svgr/webpack`
- Vite (lib build) uses `vite-plugin-svgr`

Both are configured to produce the named exports, so the SVGs are loaded like so:

```typescript
import { ReactComponent as Icon } from "@/assets/Icon.svg";
```

_Note: The standard config, we use across packages is defined in [svgrOptions.js](./pkg/scaffold/svgrOptions.js)_

#### Using width and height

Also, both are configured to remove the `width` and `height` attributes. Because of this, the SVGs should be rendered within a `<div>` container with specifically set `width` and `height`.

#### Setting the color of an SVG

The color property is not transformed automatically, as this is tedious to implement and might cause undesirable behaviour. Therefre, SVG files should be updated manually, with each explicitly defined color changed to `currentColor` like so: `fill="#0000"` -> `fill="currentColor"`, so that the given color can be maniplated using a css `color` property on a parent component.

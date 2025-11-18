# Agent Guidelines for Librocco

## Build/Test Commands
- **Install/Update**: `rush update && rush build` (installs deps, links packages, builds all)
- **Build all**: `rush build` (builds pkg/* and plugins/* only, not apps)
- **Build web-client**: `cd apps/web-client && rushx build:prod`
- **Start dev server**: `cd apps/web-client && rushx start`
- **Run tests**: `rushx test` (Vitest UI) or `rushx test:ci` (CI mode)
- **Run single test file**: `cd <package> && npx vitest run path/to/test.test.ts`
- **E2E tests**: `cd apps/e2e && rushx test:run` (or `test:open` for UI)
- **Lint**: `rush lint` (bulk) or `rushx lint` (single package, allows warnings) / `rushx lint:strict` (no warnings)
- **Typecheck**: `rush typecheck` (bulk) or `rushx typecheck` (single package)
- **Format**: `rushx format` (prettier write)

## Code Style
- **Imports**: Use `$lib/` aliases in SvelteKit, no restricted imports (e.g., use `$lib/utils/navigation` for goto, not `$app/navigation`)
- **Formatting**: Tabs (width 2), double quotes, 140 char line width, no trailing commas (see `.prettierrc.cjs`)
- **Types**: Strict TypeScript enabled, use explicit types for function params/returns, avoid `any` where possible (`@typescript-eslint/no-explicit-any` is off but use sparingly)
- **Naming**: camelCase for functions/vars, PascalCase for types/components, descriptive names preferred
- **Error Handling**: Explicit error handling, avoid silent failures
- **Tests**: Use Vitest, place tests in `__tests__/` or adjacent `.test.ts`/`.spec.ts` files
- **Comments**: JSDoc for exported functions explaining purpose, params, returns (see `pkg/shared/src/utils/sort.ts` for examples)
- **Files**: `*.ts` for logic, `*.svelte` for components, strict ESLint for TS (no warnings in CI)

## Monorepo Structure
- **Rush managed**: Node 20, pnpm 8.7.0, projects in `apps/`, `pkg/`, `plugins/`
- **Workspace deps**: Use `"workspace:*"` for local package dependencies
- **Add deps**: `rush add -p <package>` (+ `--dev` for devDeps) from package dir, then `rush update`

## Caveats
- Github actions in `.github/workflows` are generated from `.github/workflow.templates` and built running `.github/build-workflows.sh`

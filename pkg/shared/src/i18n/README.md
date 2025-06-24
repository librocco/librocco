# Translations Workflow (`typesafe-i18n` + Weblate)

The source of truth for translations is [`en/index.ts`](./en/index.ts).
This file is manually maintained by developers to include all translation keys and their English values. These keys must match the usage in code (e.g., `$LL.nav.search()`).

---

## 👨‍💻 Developer Workflow

### 1. Add a New Translation

1. In your Svelte code, write translation keys like `$LL.nav.search()` or destructure namespaces from `$LL`.
2. Manually add the new key and its English string to `en/index.ts`.

> ⚠️ `en/index.ts` is the only translation file you should manually edit as a developer.

---

### 2. Keep Types in Sync

While developing, it's recommended to run the following in the background:

```bash
rushx typesafe-i18n
```

This auto-generates the required i18n support files:

- i18n-types.ts
- i18n-util.ts
- i18n-util.sync.ts
- i18n-util.async.ts
- i18n-svelte.ts
- formatters.ts

These ensure type safety and autocompletion throughout your app.

### 3. Export JSON for Translators

To keep the `.json` translation files for all languages up to date:

```bash
rushx typesafe-i18n-sync
```

This script will:

- Create missing `.json` files for new locales
- Add any missing translation keys from `en/index.ts` with empty values
- Remove keys that no longer exist in `en/index.ts`
- Preserve all existing translations

### 4. Adding a New Locale

Create a new directory under `src/i18n/`, using the locale code (e.g., `fr`) to name the directory.

Create a `index.ts` file like the following:

```ts
import { extendDictionary } from "../i18n-util";
import { prepareTranslations } from "../utils";
import en from "../en";
import frJson from "./index.json";

const fr = extendDictionary(en, prepareTranslations(en, frJson));

export default fr;
```

Then run:

```bash
rushx typesafe-i18n-sync
```

This will populate the `fr/index.json` with all translation keys, ready for translation.
It will also update all relevant `typesafe-i18n` files with the new locale.

## 🌍 Translator Workflow (Weblate)

Weblate is used by translators to work on `.json` files for each locale.

- Weblate is updated via webhook on push to the repository
- Weblate commits translations back to the repo
- The `.ts` files import the `.json` files and filter out empty values using the `prepareTranslations` utility function
- The `extendDictionary` function merges the base English translations and provides fallbacks when translations are missing

---
title: Book Data Plugins
description: Automatically fetch book metadata by ISBN using data plugins.
---

Librocco supports **book data plugins** that fetch metadata (title, author, publisher, cover) when you enter an ISBN. This saves time during stock entry and reduces manual errors.

## Available plugins

| Plugin | Source | Notes |
|---|---|---|
| `@librocco/google-books-api-plugin` | Google Books API | Requires API key |
| `@librocco/open-library-api-plugin` | Open Library | Free, no key required |

## Installing a plugin

Plugins are already part of the monorepo. To enable one, configure it in the web client's environment:

```bash
# apps/web-client/.env
VITE_BOOK_DATA_PLUGIN=open-library
```

Available values: `google-books`, `open-library`.

## Google Books plugin

Requires a Google Books API key. Add it to your environment:

```bash
VITE_GOOGLE_BOOKS_API_KEY=your_api_key_here
```

API keys can be obtained from the [Google Cloud Console](https://console.cloud.google.com).

## Open Library plugin

No API key required. Uses the [Open Library API](https://openlibrary.org/developers/api) which is free and open.

Coverage is broad but not complete — some ISBNs, especially for older or regional titles, may not return results.

## Fallback behaviour

If a plugin returns no result, Librocco will still allow you to add the book — you'll just need to fill in the title and author manually.

## Writing a custom plugin

The `@librocco/book-data-extension` package defines the plugin interface. Any object implementing that interface can be used as a plugin.

```ts
import type { BookDataPlugin } from "@librocco/book-data-extension";

const myPlugin: BookDataPlugin = {
  fetchByIsbn: async (isbn: string) => {
    // return BookEntry | null
  },
};
```

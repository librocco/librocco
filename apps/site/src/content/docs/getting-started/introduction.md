---
title: Introduction
description: What is Librocco and why does it exist.
---

Librocco is an **offline-first bookstore inventory management tool** — built for independent bookshops that need to work reliably whether or not they have an internet connection.

## What it does

- Track stock levels across your inventory
- Record sales and purchases
- Sync data across devices when connectivity is available
- Work fully offline, with no degraded experience

## Why offline-first?

Most inventory tools assume a stable internet connection. For small bookshops — at markets, fairs, or in areas with unreliable connectivity — that's a real problem.

Librocco uses [CR-SQLite](https://github.com/vlcn-io/cr-sqlite) (Conflict-free Replicated SQLite) to keep data consistent across devices without requiring a central server to always be available. Changes made offline are merged automatically when devices reconnect.

## Next steps

- [Installation](/docs/getting-started/installation) — get Librocco running locally
- [Quick start](/docs/getting-started/quick-start) — add your first books and record a sale
- [Architecture overview](/docs/architecture/overview) — understand how the pieces fit together

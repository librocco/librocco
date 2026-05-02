---
title: Installation
description: How to install and run Librocco locally.
---

import { Tabs, TabItem } from "@astrojs/starlight/components";

## Prerequisites

- **Node.js** `>=22.22.0 <23.0.0`
- **pnpm** `9.15.4`
- **Rush** `5.164.0`

## Install Rush and pnpm

```bash
npm install -g @microsoft/rush pnpm
```

## Clone the repository

```bash
git clone https://github.com/codemyriad/librocco.git
cd librocco
```

## Install dependencies

From anywhere in the project root:

```bash
rush update
```

This installs all packages and links local dependencies across the monorepo.

## Build packages

```bash
rush build
```

This builds all library packages in `pkg/` and `plugins/`. The web client app is excluded from the bulk build for performance — see [running the app](#run-the-app).

## Run the app

```bash
cd apps/web-client
rushx start
```

The dev server will start at `http://localhost:5173`.

## Run with sync server

To enable multi-device sync, start the sync server alongside the client:

```bash
# Terminal 1
cd apps/sync-server
rushx start

# Terminal 2
cd apps/web-client
rushx start
```

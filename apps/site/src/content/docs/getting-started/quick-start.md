---
title: Quick Start
description: Add your first books and record a sale in Librocco.
---

This guide walks you through the basics after you have Librocco running locally.

## 1. Create a warehouse

Librocco organises inventory into **warehouses**. A warehouse represents a physical location or logical grouping of stock.

1. Open the app at `http://localhost:5173`
2. Navigate to **Warehouses** in the sidebar
3. Click **New Warehouse** and give it a name

## 2. Add books to inventory

Books are identified by ISBN. You can add them manually or use the book data plugins to auto-fill details.

1. Select your warehouse
2. Click **Add Stock**
3. Enter an ISBN — if a book data plugin is configured, title and author will be fetched automatically
4. Set the quantity and confirm

## 3. Record a sale

1. Navigate to **Point of Sale**
2. Scan or enter ISBNs for the books being sold
3. Confirm the transaction

Stock levels update immediately and the change is queued for sync if other devices are connected.

## 4. Sync across devices

If you have the sync server running, changes from one device propagate to others automatically when connected. No manual action is required.

## Next steps

- [Configure book data plugins](/docs/guides/book-data-plugins) to auto-fill book details
- [Set up the sync server](/docs/guides/sync-server) for multi-device use

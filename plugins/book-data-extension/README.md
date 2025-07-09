# Book data extension plugin

The book data extension plugin satisfies the book data plugin interface (as specified by the db plugins spec). In the main app it is used to speed up the input of book data: if there's no book data in the DB (for a given ISBN), the data can be input manually, or autofilled using the book extension plugin.

This plugin instance uses the (Chrome) extension to fetch data from open sources (Anna's archive) and is split in two parts:

- the plugin interface
- the extension itself

_Note: the plugin interface part can be used with any extension satisfying the messaging spec (and functionality)._

## Contents

1. [Plugin interface](#1-plugin-interface):

   1. [Registering the plugin with the DB interface instance](#11-registering-the-plugin-with-db-interface-instance)
   2. [The functionality (as specified by the book data plugin interface)](#12-the-functionality-as-specified-by-book-data-plugin-in-interface)

2. [Communication layer](#2-communication-layer):

   1. [The messaging spec](#21-the-messaging-spec)

3. [The extension](#3-the-extension)
   1. [Installation](#31-installation)
   2. [Base implementation](#32-base-implementation)

## 1. Plugin interface

This part of the plugin is an interface satisfying the plugin API as specified by the DB interface and providing a bridge between the actual extension and the plugin system.

### 1.1. Registering the plugin with DB interface instance

The plugin can be registered with the db interface like so:

```ts
// Initialise the librocco db interface instance
import { newInventoryDatabaseInterface } from "@librocco/db";

// Pouch instance needs to be created (beyond the scope of this doc)
const db = newInventoryDatabaseInterface(pouch);

// The db is initialised using the fallback interface for the book data plugin (it will respond with false, not found, etc)
//
// Example
const bookData = db.plugin("book-fetcher").fetchBookData(/* a list of isbns to fetch */); // Returns and empty array (fallback)

// Create the book data extension plugin instance and register it with the db
import { createBookDataExtensionPlugin } from "@librocco/book-data-extension";

// TO_ALWAYS_DO: This should always be done at the initial app load (making the plugin available to all consumers via the db interface)
const bookDataExtensionPlugin = createBookDataExtensionPlugin();
db.plugin("book-data").register(bookDataExtensionPlugin);

// An instance of book data extension plugin will be used to query book data
//
// Example
const bookData = db.plugin("book-fetcher").fetchBookData(/* a list of isbns to fetch */);
// ^ Returns an array looking something like this [{ book data 1 }, { book data 2 }, ...etc]
```

### 1.2. The functionality (as specified by book data plugin in interface):

- `fetchBookData` - accepts a list of isbns, communicates the request with the extension and listens for the message with retrieved book data
- `isAvailableStream` - an observable (created on init) signaling the availability of the extension and it does so by concatenating two streams:
  - one-off ping request (to check initial extension availability state)
  - a stream derived from availability messages (see the [extension section](#base-implementation) for more details)

## 2. Communication layer

As mentioned, the plugin communicates with the extension over the specified set of messages and expected responses, and, as such, communicates with the base extension implementation, but could also communicate with any extended implementation so long as the messaging spec is respected.

The messaging itself is implemented over `window.postMessage` (for sending) and `window.addEventListener("message", ...params)` (for listening for messages/responses).

### 2.1. The messaging spec

- **ping:**
  - the book data extension plugin sends `BOOK_FETCHER:PING` message and expects the complementary `BOOK_FETCHER:PONG` message to be dispatched from the extension (within a certain timeout)
- **availability stream:**
  - when the book data extension becomes available it should register with the plugin by dispatching a `BOOK_FETCHER:ACTIVE` message with payload `{isActive: true}`, similarly, when the extension is unloaded, it's expected to dispatch `BOOK_FETCHER:ACTIVE` with payload `{isActive: false}`
- **book data fetching:**

  - the `fetchBookData` (interface method) accepts a list of isbns, that list is then broken down to one request per each isbn
  - each book data request is dispatched against the extension using `BOOK_FETCHER:REQ:<isbn>` message
  - for each request, a new listener is created, waiting for the response in form of a `BOOK_FETCHER:RES<isbn>` with payload of book data, the wait is capped with a timeout (to prevent the app from hanging)
  - the response should include the book data in the message like so:

  ```ts
  // Response for a book with isbn 1234567890
  window.postMessage(
    {
      message: `BOOK_FETCHER:RES:1234567890`,
      book: { ...book, isbn: "1234567890" }
    },
    "*"
  );
  ```

## 3. The extension

### 3.1. Installation

The extension is currently available in dev mode, to install it follow these steps:

- clone the repo (if hadn't done so already)
- build the packages (using `rush build`, as described in the top level [README.md](../../README.md))
- open the extensions section in Chrome: go to [chrome://extensions](chrome://extensions)
- enable dev mode (switch at the upper right corner of the screen)
- click `Load unpacked` and select the plugin folder (`<repo_root>/plugins/book-data-extension`)

### 3.2. Base implementation

The base implementation of the extension uses only Anna's Archive to retrieve the book data.

- **ping:**
  - straightforward, when the extension is pinged it responds with a pong
- **availabilityStream:**
  - the availbility stream currently works only for unloading of the extension as the content script is loaded on page load (if the extension is available, signaling availability)
  - the content script pings the background script on every second interval and, if the ping returns the error, it logs the error to the console and dispatches the `BOOK_FETCHER:ACTIVE:FALSE` message
- **fetchBookData** - takes the isbn, queries Anna's Archive and returns the book data (if found), if not, returns undefined

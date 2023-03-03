# @librocco/db

This package is created to house multiple implementations of the standardised database interface (for use by the client app).

Each version, should implement a standardised type interface, and have the same behaviour towards the client, but, under the hood, it could use any data model (or possible any DBMS).

## Table of contents

1. [Package/folder structure](#1-package-structure)

    - 1.1. [Types](#11-types)
    - 1.2. [TestRunner](#12-test-runner)
    - 1.3. [Exports](#13-exports)

2. [Usage](#2-usage)

    - 2.1. [Database interface](#21-database-interface)

        - 2.1.1. [Instantiating the interface](#211-instantiating-the-interface)
        - 2.1.2. [Initialising the interface](#212-initialising-the-interface)
        - 2.1.3. [Remote replication](#213-remote-replication)
        - 2.1.4. [Idempotency](#214-idempotency)
        - 2.1.5. [Stream](#215-stream)
        - 2.1.6. [Accessing other structures](#216-accessing-other-structures)
        - 2.1.7. [Find Note](#217-find-note)
        - 2.1.8. [Additinal methods/properties](#218-additional-methodsproperties)

    - 2.2. [Chainable model of notes and warehouses](#22-chainable-model-of-notes-and-warehouses)

    - 2.3. [Warehouse interface](#23-warehouse-interface)

        - 2.3.1. [CRUD](#231-crud)
        - 2.3.2. [Stream](#232-stream)

    - 2.4. [Note interface](#24-note-interface)

        - 2.4.1. [Inbound/outbound](#241-inboundoutbound)
        - 2.4.2. [Note states](#242-note-states)
        - 2.4.3. [CRUD](#243-crud)
        - 2.4.4. [Stream](#244-stream)
        - 2.4.5. [Additional methods](#245-additional-methods)

## 1. Package structure

In this section we will go over the package structure, as well as showcase the approaches used to achieve standardised interface and behaviour regardless of implementation.

### 1.1. Types

In order to provide the same interface to the consumer (the client app), we've created a standard type interface, which is available to the client, and each implementation should satisfy (implement) that interface.

The standard type interface itself can be found in [./src/types.ts](./src/types.ts).

It is created in such a way to serve as the foundation for different implementations. As such, it is made highly generic, so each implementation can extend the types to include additional properties and methods.

_Note: Each implementation should satisfy the standard interface and can extend it if necessary, however, only the standard methods/properties should be relied on by the client as well as the unit tests._

### 1.2. Test Runner

Using the standardised type interface, and each implementation having to satisfy that interface, we were able to create a suite of standardised tests, testing the expected behaviour of the interface, without getting into implementation specific details. As such, unit tests can be ran against any specific implementation and should produce the same result.

To take things further, we've implemented a test runner which can take in different implementations and run the test suite against each of them.

[More on test runner implementation here](./src/test-runner/README.md)

### 1.3. Exports

The package exprts:

-   the standardised type interface (for client usage)
-   current version of the database interface implementation

## 2. Usage

The db interface is created to satisfy our client app's needs. Being a book inventory management solution, the app organises book inventory as well as changes to said inventory. As such, our db interface is organised around the following structures:

-   warehouse:

    -   warehouse is a section of the stock inventory
    -   a warehouse could be an actual (physical) warehouse, or a simbolic one (representing a section of books in the store)
    -   each warehouse tracks inventory stock at a given point in time

    _Note: There can be multiple different warehouses, but there's always one (special) default warehouse. Each warehouse displays its own stock, while the default warehouse displays the entirety of the book stock (for all warehouses)._

-   note:

    -   a note represents a single, contained, collection of transactions (changes in inventory)
    -   notes can be **inbound** or **outbound**
    -   **outbound** note example: A customer walks into the store (or is ordering online) and purchases some amount of books. This creates an **outbound** note, lists all of the books on the receipt as transactions, and all transactions displayed on the note (books and quantities of each book bought) decrement the stock for a given book in a given warehouse.
    -   **inbound** note example: The store acquires some amount of books (be it a delivery from the distributor or an acquisition of used books). The **inbound** note is created, all of the books acquired (and their respective quantities) are listed as transactions in the note and all transactions increment the stock for a given book in a given warehouse.

    _Note: Each inbound note belongs to a particular (non-default) warehouse: all of the transactions in the (inbound) note increment the stock for a given book in the same warehouse (the one the note belongs to), while outbound notes all belong to the default warehouse: every transaction in an outbound note contains data logging from which particular warehouse some amount of books was taken._

-   books:
    -   this part of the db interface is not yet fully developed, but it's, essentially, a part of the db containing data for each book
    -   each time the book transactions, or book stock are displayed by the client app, isbns and quantities are pulled from warehouse/note displayed while the book data (such as year, author(s), publisher) is retrieved from the books section for each given book

### 2.1. Database Interface

#### 2.1.1. Instantiating the interface

As mentioned above, the package exports a function used to crate a new db interface instance, e.g.:

```typescript
import { newDatabaseInterface } from '@librocco/db';

// Currently, as we're using CouchDB/PouchDB, the implementation
// accepts a PouchDB.Database instance and builds an interface around it.
import PouchDB from 'pouchdb';

const pouch = new PouchDB('some-db-name');
const db = newDatabaseInterface(pouch);
```

#### 2.1.2. Initialising the interface

The code above **instantiates** a db interface and we can start using the db immediately (for streams and such...more below).

However, this doesn't guarantee that the database itself has been initialised. The database needs to be initialised only the first time it's used. In context of our currently used DBMS (CoudbDB/PouchDB), database being initialised would mean:

-   the design documents are uploaded
-   default warehouse has been created

To initialise the database, we run `db.init()`

```typescript
const db = newDatabaseInterface(pouch);
await db.init({}, {});
```

The `db.init` method returns a promise which can be awaited to ensure the initalisation process has finished. This is useful if we wish to show a loading page and then update the UI when the db has been initialised (the example below is using svelte to illustrate such behaviour):

```svelte
<script>
    const db = newDatabaseInterface(pouch);
</script>

{#await db.init({}, {})}
    <p>Initialising the db...</p>
{:then db}
    <p>DB initialised</p>
    <!-- Use the db with assurance that the default warehouse is created and design documents uploaded -->
{/await}
```

#### 2.1.3. Remote replication

Additional (optional) part of the `db.init()` method, is remote replication. Remote replication is not initialising the database per se, but is updating the local db (in-browser PouchDB) with the latest state in the remote db and opening up a live, bidirectional replication with the remote db.

To include the replication setup in the `db.init` method, we simply pass the address to the remote db (including auth and db name), like so:

```typescript
const db = newDatabaseInterface(pouch);

const remoteDb = 'http://user:password@127.0.0.1:5000/dev';

db.init({ remoteDb }, {});
```

Remote db string:

-   `user:password` are the auth for the connection to the remote db
-   `127.0.0.1:5000` is (obviously) the `host:port` part of the connection
-   `dev` is the name of the database (in the remote instance) we're replicating to and from

In this case, when the db.init() has resolved, we're certain that the default warehouse is created, the design documents are uploaded and the initial replication is done (the remote db is replicated into the local db).

_Note: Even if the database itself was initialised (if this is not the first time we're running the db), we have to run `db.init({ remoteDB }, {})`, after instantiating the db, if we want live replication with the remote db._

#### 2.1.4. Idempotency

The `db.init` method is idempotent in a way that it initialises only once, after which it sets an internal flag (`initialised`) to true, so each subsequent call to `db.init` resolved immediately (with no-op). This is convenient when we're running a load function on for each route or something like that (where the db can be initialised only once). A simplified example:

```typescript
import PouchDB from 'pouchdb';
import { newDatabaseInterface } from '@librocco/db';

const pouch = new PouchDB('dev');
const db = newDatabaseInterface(pouch);

const remoteDb = 'http://some:remote@db:1234/name';

// This function is ran on each route (params) change
async function load({ params }) {
	// This is ran on each function run, but, in effect, the initialisation is ran only once.
	// Every subsequent run simply returns the db
	await db.init({ remoteDb }, {});

	return db.note(params.id);
}
```

#### 2.1.5. Stream

Running `db.stream({})` an object containing db streams is returned.
The stream object contains three observable streams (all to be used for navigation list for the specific view):

-   warehouseList - used to stream a list of warehouse `id`s with their respective `displayName`s (to be used as navigation in stock view)
-   inNoteList:
    -   used to stream a list of warehouse `id`s, their respective `displayName`s and all inbound notes (their `id`s and `displayName`s) belonging to the respective warehouse
    -   _note: The notes under the default ("All") warehouse are **not outbound** notes (as this is an inbound note list), but rather a list of all inbound notes (regardless of warehouse, they belong to)_
-   outNoteList:
    -   used to stream a list of outbound note `id`s with their respective `displayName`s

#### 2.1.6. Accessing other structures

Accessing nested structures (warehouses/notes) can be done by chaining after db interface:

```typescript
const wh1 = db.warehouse('warehouse-1');
const note1 = wh1.note('note-1');

// Naturally, note1 could also be reached like this
const note1 = db.warehouse('warehouse-1').note('note-1');
```

More on initialising note/warehouse later.

#### 2.1.7. Find note

Note and its corresponting warehouse can also be accessed by note id, using the `db.findNote()` method, which checks if the note exists and (if it does), returns the note and its parent warehouse (in form of an object containing both `note` as note interface and `warehouse` as warehouse interface).

#### 2.1.8. Additional methods/properties

There are a couple of additional methods on the db interface, but those exist more for internal usage, rather than for client usage (as all of their functionality can be achieved, in a simplified way using other abstractions). These are:

-   `db.updateDesignDocument` - a method used to update the design document in the db (there's no need to run this manually as all design documents are updated with `db.init` method)
-   `db._pouch` - a reference to an embeded pouchdb instance around which the db interface is built (there are some really rare cases where this should be used directly)

### 2.2. Chainable model of notes and warehouses

Before diving into note and warehouse interface, we should explain some concepts shared among the two. We wanted the nested structures to be chainable, like so:

```typescript
const wh1 = db.warehouse('warehouse-1');
const note1 = db.warehouse('warehouse-1').note('note-1');
```

This was a bit of a challenge as both `warehouse` and `note` need to pull the data from the db, and we didn't want to have to await each time as that kinda messes up the chainability - we would have to do something like this each time:

```typescript
const wh1 = await db.warehouse('warehouse-1');
const note1 = await wh1.note('note-1');
```

Additionally, there's an asimetry in the way the existing notes/warehouses would be handled vs how the new ones are crated.

**The solution**: Each call to `.warehouse` or `.note` creates a new instance (locally). That instance is populated with the default data to begin with, while fetching of the data for the instance is done in the background. The problem with this is that we can't know for sure if the data inside the instance is the default one or the one pulled from the db. This problem is in part solved, and, in part is not a problem at all.

The partial solution is that each call to `.warehouse` or `.note` fetches data from the db (if one exists) in the background. When data is fetched (or entry doesn't exist), a boolean value is streamed internally notifying the instance that it's initialised and it exists (or doesn't exist).

All methods, requiring actual data (such as `setName`, `commit`, `delete`, etc.) first check the `initialised` stream to see if the instance is initialised. If the instance is already initialised, the action is ran immediately, of not the action is "queued" to run after the instance has been initialised: it awaits the stream (with a given timeout) and runs right after.

The solution for "getters" is a simple fact that this isn't a problem at all: In production we will alway want to have the real time data, meaning all of the data retrieved has to be streamed. Since the streames are created against the db in the first place, it doesn't, in any way, depend on the local instance being initialised.

Finally, there's an imperative method `.get` (as in `note.get()` or `warehouse.get()`). It returns a promise, which, when awaited, guarantees we will have a deterministic solution: if the structure exists in db, an appropriate interface (note/warheouse) will be created from it, if not, it will resolve to `undefined`.

```typescript
const note1 = await db.warehouse('warehouse-1').note('note-1').get();
// Note 1 is either 'undefined' or NoteInterface populated with the up-to-date data
```

_Please note that this method should mostly be used for testing and quick and controlled assertions, while in production, it is always better to subscribe to a stream and handle the updates in real time._

Other way in which notes/warehouses are chainable is on update methods. These are async and always return a promise, but will resolve to the same interface. E.g.

```typescript
const note = await db.warehouse().note().get();
console.log(note.displayName); // Let's say the display name is "New Note"

const updatedNote = await note.setName('Another Name');
console.log(updatedNote.displayName); // "Another Name"
console.log(note.displayName); // also prints out "Another Name"
// What's more...
note === updatedNote; // Evaluates to 'true' as they're both a reference to the same note interface instance
```

### 2.3. Warehouse interface

Warehouse interface is used for warehouse related operations against the db and is instantiated using the db interface (and passing a warehouse id to the method):

```typescript
const db = newDatabaseInterface(pouch);
const wh1 = db.warehouse('warehouse-1');
```

_Note: the default warehouse ("0-all") is instantiated if no id is passed, like so:_

```typescript
const db = newDatabaseInterface(pouch);
const defaultWarehouse = db.warehouse();
// This is equivalent to running
const defaultWarehouse = db.warehouse('0-all');
```

#### 2.3.1. CRUD

##### Create

To create a warehouse, we first instantiate the local instance and run `.create()`, like so:

```typescript
const wh1 = await db.warehouse('warehouse-1').create();
```

_Note: Create function is idempotent: if the warehouse already exists, it will simply return the warehouse interface._

##### Read

As mentioned above, when the warehouse interface is instantiated, it will pull the data from the db in the background.
If we want to explicitly await the instance to be populated with the data from db (or check if it exists). We can do:

```typescript
const wh1 = await db.warehouse('warehouse-1').get();
```

However, most of the data we'll need to receive from the warehouse will be streamed, making the explicit await unnecessary and this (`warehouse.get()`) should be used to check if the warehouse exists in the db, or for debugging/explicit control during unit/integration tests.

_Note that running warehouse.get() on an already initialised instance will resolve immediately, without making additional requests to the db._

##### Update

As for update, there's no public method `warehouse.update`. Instead, all of the updates can be achieved using more fine grained methods (in case of warehouse, there's only `warehouse.setName`):

```typescript
const w = db.warehouse('warehouse-1');
await w.setName('Custome name'); // Sets the warehouse 'displayName' to "Custom name"
```

##### Delete

To delete the warehouse, in theory, we can run:

```typescript
const w = db.warehouse('warehouse-1');
await w.delete();
```

and it will delete the warehouse document (if it exists in the db), but we're still undecided as to how exactly warehouse deletion should behave, so this feature is still WIP.

#### 2.3.2. Stream

The warehouse interface has a `.stream` method which returns a stream object, containing observable streams, streaming the `displayName` and `entries`:

```typescript
const stream = db.warehouse('warehouse-1').stream();
const { displayName, entries } = stream;

// Streams the display name (updated in real time)
displayName.subscribe((dn) => {
	/* Do something with the 'displayName' */
});

// Streams the warehouse stock (updated in real time)
entries.subscribe((entries) => {
	/* Do something with the 'entries' (warehouse stock) */
});
```

While the `displayName` stream is self-explanatory, `entries` streams the stock of book inventory for a warehouse. This is a snapshot of all the books in the warehouse at current time. The quantities (per book), are the result of all **committed** inbound/outbound notes (and their transactions).

_Note: Each named warehouse will stream its own stock, while the default warehouse ("All") will display the entirety of the inventory (with books, quantities and the warehouse to which those books belong)._

The values streamed are entries of `isbn`, `quantity`, `warehouseId`, `warehouseName` (for each entry) and for display purposes they should be merged with book data (retrieved from different part of the db, using `db.getBooks`).

### 2.4. Note interface

Note interface is used for note related operations against the db and is instantiated using the warehouse interface (and passing a note id to the method):

```typescript
const db = newDatabaseInterface(pouch);
const wh1 = db.warehouse('warehouse-1').note('note-1');
```

#### 2.4.1. Inbound/outbound

##### Inbound notes:

-   represent a collection of inbound transactions of books (e.g. acquisition of used books, delivery from the supplier)
-   increment the inventory stock by quantities specified in transactions
-   they "belong" to a non-default warehouse
-   all transactions operate on the same (parent) warehouse

Inbound notes are accessed (or created) by explicitly specifying a warehouse:

```typescript
// Access a (possibly) existing inbound note, belonging to "warehouse-1" with the id of "note-1"
const existingInNote = db.warehouse('warehouse-1').note('note-1');

// Instantiate a (new) inbound note with generated id, belonging to "warehouse-1"
const newInNote = db.warehouse('warehouse-1').note();
```

##### Outbound notes:

-   represent a collection of outbound transactions of books (e.g. sale, write off, and such)
-   decrement the inventory stock in warehouses specified in transactions, by quantities specified in transactions
-   all "belong" to the default warehouse
-   transactions operate on (possibly) different non-default warehouses, which need to be specified for each transaction

Outbound notes are accessed (or created) by not specifying a warehouse, or explicitly specifying the default warehouse (former is preferred):

```typescript
// Access a (possibly) existing outbound note with the id of "note-1"
const existingOutNote = db.warehouse().note('note-1');

// Instantiate a (new) outbound note with generated id
const newOutNote = db.warehouse().note();
```

#### 2.4.2. Note states

Note can be in one of two states: `draft` or `committed`:

When the note is in `draft` state, it's being worked on, transactions are added or updated, the name can be changed. The changes are recorded (and saved) in real time, but the transactions in the note don't affect the calculated state of the inventory.

When the note is `committed`, all updates are locked (transactions or display name) and transactions are taken into account when calculating the stock.

#### 2.4.3. CRUD

##### Create

To create a note, we first instantiate the local instance and run `.create()`, like so:

```typescript
// Inbound note in "warehouse-1"
// "note-1" doesn't yet exist, but is instantiated (with default values) locally
const note1 = await db.warehouse('warehouse-1').note('note-1');
// Create a new "note-1" document in the db
await note1.create();

// Outbound note
const note2 = await db.warehouse().note('note-2').create();
```

When creating a note, we can also instantiate the note interface without passing the id. This is actually a prefered way of creating a note in production as the new id is generated using `uniqueTimestamp` helper function. The id created is a uuid-like string created from the timestamp, which gives us the ability to sort the notes by time created, using the id.

```typescript
// Inbound note in "warehouse-1"
const note1 = await db.warehouse('warehouse-1').note().create();

// And the same for outbound note
const note2 = await db.warehouse().note().create();
```

If note warehouse doesn't exist, it will be created when creating the note, e.g.:

```typescript
// Say "warehouse-1" doesn't exist in the db
let w1 = await db.warehouse('warehouse-1').get();
console.log(w1); // Prints out 'undefined'

const n1 = await db.warehouse('warehouse-1').note().create(); // Creates a note, but also a warehouse

// In the process of creating the note, the "warehouse-1" has been created
w1 = await db.warehouse('warehouse-1').get();
console.log(w1); // Prints out warehouse interface with id "warehouse-1" and default fields
```

_Note: Create function is idempotent: if the note already exists, it will simply return the note interface and since warehouse.create() is also idempotent, attempting to create note's warehouse on each note creation is a no-op if the warehouse already exists._

##### Read

As mentioned above, when the note interface is instantiated, it will pull the data from the db in the background.
If we want to explicitly await the instance to be populated with the data from db (or check if it exists). We can do:

```typescript
const n1 = await db.warehouse('warehouse-1').note('note-1').get();
```

However, most of the data we'll need to receive from the note will be streamed, making the explicit await unnecessary and this (`note.get()`) should be used to check if the note exists in the db, or for debugging/explicit control during unit/integration tests.

_Note that running note.get() on an already initialised instance will resolve immediately, without making additional requests to the db._

##### Update

As for update, there's no public method `note.update`. Instead, all of the updates can be achieved using more fine grained methods:

**Set name:**

```typescript
const n1 = db.warehouse('warehouse-1').note('note-1');
await w.setName('Custome name'); // Sets the note 'displayName' to "Custom name"
```

**Add volumes:**

To add volumes to the note (by scanning books, or manually adding the book and quantity), we use `note.addVolumes` method. It accepts a volume transaction tuple:

```typescript
// Values representing [note id, quantity, warehouse id]
type VolumeTransactionTuple = [string, number, string];
```

Warehouse id :point_up: is optional (as for inbound notes, the warehouse for transaction is the same as the warehouse the inbound note belongs to), however, it's a recommended to always pass it in.

To add volume transactions, we can run `note.addVolumes` in two ways:

```typescript
// '12345678' being an isbn
// 2 being the quantity
// warehouse-1 being the warehouse id
note.addVolumes('12345678', 2, 'warehouse-1');

// Adding multiple entries (passing any number of volume quantity tuples, in a ...rest params fashion)
note.addVolumes(['12345678', 2, 'warehouse-1'], ['11111111', 5, 'warehouse-1'], ['00000001', 3, 'warehouse-1']);
```

When adding a transaction with an isbn and warehouse id matching an existing transaction in the note, the quantity is compounded:

```typescript
await note1.addVolumes('12345678', 2);
console.log(note1.entries); // Prints out [{isbn: "12345678", warehouseId: "warehouse-1", quantity: 2}]

// Add another transaction with the same isbn and warehouse id
await note1.addVolumes('12345678', 3);
console.log(note1.entries); // Prints out [{isbn: "12345678", warehouseId: "warehouse-1", quantity: 5}]
```

**Update transaction:**

When the transaction already exists, we can run `note.updateTransaction` to update the transaction (either set new quantity, change warehouse or so, e.g.)

```typescript
const note1 = db.warehouse('warehouse-1').note().create();
await note1.addVolumes('12345678', 5);
console.log(note1.entries); // Prints out [{isbn: "12345678", warehouseId: "warehouse-1", quantity: 5}]

// Update the transaction row (for "12345678") to have the quantity of 2 (instead of 5)
await note.updateTransaction({ isbn: '12345678', warehouseId: 'warehouse-1', quantity: 2 });
console.log(note1.entries); // Prints out [{isbn: "12345678", warehouseId: "warehouse-1", quantity: 2}]

// This can also be applied to change a warehouse in an outbound note
const note2 = db.warehouse().note().create();
await note2.addVolumes('12345678', 2, 'warehouse-1');
console.log(note2.entries); // Prints out [{isbn: "12345678", warehouseId: "warehouse-1", quantity: 2}]

await note.updateTransaction({ isbn: '12345678', warehouseId: 'warehouse-2', quantity: 5 });
console.log(note2.entries); // Prints out [{isbn: "12345678", warehouseId: "warehouse-2", quantity: 5}]
```

Running `note.updateTransaction` with the transaction which doesn't exist in the note will simply add it to the note:

```typescript
// Create a new (empty) note
const note1 = db.warehouse().create().get();

// A valid operation, simply adds the transaction to the note
await note1.updateTransaction({ isbn: '12345678', warehouseId: 'warehouse-1', quantity: 5 });
```

##### Delete

To delete the note, we simply run:

```typescript
await note1.delete();
```

#### 2.4.4. Stream

The note interface has a `.stream` method which returns a stream object, containing observable streams, streaming the `displayName`, `entries`, `state` and `updatedAt`:

```typescript
// Outbound note is used, but streaming functionality exactly the same for inbound notes.
const stream = db.warehouse().note().stream();
const { displayName, entries, state, updatedAt } = stream;

// Streams the display name (updated in real time)
displayName.subscribe((dn) => {
	/* Do something with the 'displayName' */
});

// Streams the transactions in the note (updated in real time)
entries.subscribe((entries) => {
	/* Do something with the 'entries' (note transactions) */
});

// Streams the note state ('draft' or 'committed', updated in real time)
state.subscribe((state) => {
	/* Do something with note 'state' */
});

// Streams the time the note was last updated (updated in real time)
state.subscribe((state) => {
	/* Do something with note 'state' */
});
```

While the `displayName` stream is self-explanatory, `entries` streams volume transactions in the note, `state` streams the note state: "open" notes are marked as 'draft', while "closed" notes are 'committed', `updatedAt` is self explanatory: the last time the note was updated (in any way).

#### 2.4.5. Additional methods

-   `note.commit` - Commit the note, making its transactions affect the stock, locking it for updates (in transactions, or name changes)

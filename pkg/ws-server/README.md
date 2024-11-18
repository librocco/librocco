# @vlcn.io/ws-server

# Basic Setup

WebSocket sync server. Setups is pretty straightforward and involves:

1. Defining a config
2. Attaching the websocket server to your http server

## Define Config

```ts
const wsConfig = {
  // Folder where database files should be placed
  dbFolder: "./dbs",
  // Folder that contains `.sql` schema files to apply to databases
  schemaFolder: "./src/schemas",
  // The path(s) that the websocket server should listen to
  pathPattern: /\/sync/,
};
```

## Attach to Server

```ts
import * as http from "http";
const app = express(); // or fastify or nest or whatever
const server = http.createServer(app);

const wsConfig = {
  dbFolder: "./dbs",
  schemaFolder: "./src/schemas",
  pathPattern: /\/sync/,
};

// Attach here:
attachWebsocketServer(server, wsConfig);

server.listen(PORT, () =>
  console.log("info", `listening on http://localhost:${PORT}!`)
);
```

# Data Flow in WebSocket Synchronization

## Initial Connection Setup

1. The client sends a request with upgrade header
2. The server authenticates the client and (on success) upgrades the connection to WS (internally, the server sets up local conn broker for communication with the DB)
3. The client announces presence

Connection is set up for two way streaming!


## Inbound Communication (Client to Server)

Othere than the aforementioned messages, in service of setup, client can send `""`


## Outbound Communication (Server to Client)

**Data Synchronization**:
   - The server uses the `OutboundStream` class to send updates back to the client, ensuring it stays synchronized with the latest database changes.
   - The `OutboundStream` listens for changes in the server's database and sends them to the client, handling backpressure if the outbound buffer is full.

## Connection Termination

6. **Connection Closure**:
   - Either the client or server can close the connection when synchronization is complete or no longer needed.

This flow ensures that both the client and server maintain a synchronized database state, with clear communication of changes and updates.

# Message Types

The client can send the following message types to the server:

- **AnnouncePresence**: Initiates synchronization for a specific room.
- **Changes**: Sends updates to be applied to the database.
- **RejectChanges**: Informs the server of changes that could not be applied.
- **StartStreaming**: Requests the server to start streaming updates (not processed by the server).
- **CreateDbOnPrimary**: Requests the creation of a database on the primary server.
- **ApplyChangesOnPrimary**: Applies changes directly on the primary server.
- **Ping**: A simple ping message to check connectivity.
- **Pong**: A response to a ping message.

These message types facilitate robust and flexible communication between the client and server, supporting various synchronization scenarios.

# Receiving Connections and Handling Messages

The WebSocket server receives connections and inbound messages through the WebSocket server setup and the `ConnectionBroker` class. Here's how it works:

## Receiving Connections

- **WebSocket Server Setup**: The `attachWebsocketServer` function attaches a WebSocket server to an existing HTTP server. It listens for HTTP upgrade requests and handles them to establish WebSocket connections. Upon a successful upgrade, it emits a "connection" event, creating a new `ConnectionBroker` instance for each connection.

- **ConnectionBroker**: The `ConnectionBroker` class handles messages from WebSocket clients. It listens for "message" events on the WebSocket connection. When a message is received, it decodes the message using the `decode` function from `@vlcn.io/ws-common`.

## Handling Received Messages

- The `ConnectionBroker` processes messages based on their type (tag):
  - **AnnouncePresence**: Initializes a new `SyncConnection` for the room and starts it.
  - **Changes**: Applies received changes to the synchronized database using the `SyncConnection`.
  - **RejectChanges**: Handles rejected changes by notifying the `SyncConnection`.
  - **StartStreaming**: This message is not processed by the server and will throw an error if received.

## Emitting and Tracking Changes

- **Emitting Changes**: The server processes incoming changes and updates the database state through the `SyncConnection`. The `SyncConnection` manages the synchronization logic and applies changes to the database.

- **Tracking Changes**: Changes are tracked through the `DBCache` and `SyncConnection`. The `DBCache` manages database connections and ensures the correct version of the database schema is used. The `SyncConnection` applies changes and manages the synchronization state, ensuring changes are correctly integrated into the database.

# LiteFS Setup

> Note: LiteFS support is not production ready. It currently does not handle 
> LiteFS primary node failover.

If you want to replicate your DB on the backend via [LiteFS](https://fly.io/docs/litefs/) you can specify a few additional configuration options.

```ts
const wsConfig = {
  dbFolder: "./dbs",
  schemaFolder: "./src/schemas",
  pathPattern: /\/sync/,
  // appName is REQUIRED for LiteFS setups
  appName: process.env.FLY_APP_NAME
};

const WRITE_FORWARD_PORT = 9000;
const dbFactory = await createLiteFSDBFactory(WRITE_FORWARD_PORT, wsConfig);
dbCache = attachWebsocketServer(
  server,
  wsConfig,
  dbFactory,
  new FSNotify(wsConfig)
);

// Set up a service to receive forwarded writes
createLiteFSWriteService(WRITE_FORWARD_PORT, wsConfig, dbCache);
```

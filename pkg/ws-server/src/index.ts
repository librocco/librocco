/**
 * @module WebSocketServer
 *
 * This module provides functionality to attach a WebSocket server to an existing HTTP server.
 * It includes classes and functions to manage database caching, file system notifications,
 * and WebSocket connections.
 */

import { IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws"; // Import WebSocket server and client classes
import { logger } from "@vlcn.io/logger-provider"; // Import logger for logging messages
import type { Server } from "http";
import DBCache from "./DBCache.js"; // Import DBCache class for managing database caching
import DB, { IDB } from "./DB.js"; // Import DB class and IDB interface for database operations
import ConnectionBroker from "./ConnectionBroker.js"; // Import ConnectionBroker for managing WebSocket connections
import { Config } from "./config.js"; // Import Config type for server configuration
import FSNotify from "./fs/FSNotify.js"; // Import FSNotify for file system notifications
export { IDBFactory } from "./DBFactory.js"; // Export IDBFactory interface for database factory
import { getDbPath } from "./DB.js"; // Import utility function to get database path
import DBFactory from "./DBFactory.js"; // Import DBFactory class for creating database instances
export { IDB } from "./DB.js"; // Export IDB interface for database operations
import { IDBFactory } from "./DBFactory.js"; // Import IDBFactory interface for database factory
import util from "./fs/util.js"; // Import utility functions for file system operations

export const internal = {
  // Export internal utilities for testing or internal use
  DBCache,
  DB,
  getDbPath,
  FSNotify,
  fsUtil: util,
};

export * from "./config.js";

/**
 * A no-operation authentication function that always calls back with no error.
 *
 * @param {IncomingMessage} req - The incoming HTTP request.
 * @param {string | null} token - The authentication token.
 * @param {(err: any) => void} cb - The callback function to call with the result of authentication.
 */
function noopAuth(
  req: IncomingMessage,
  token: string | null,
  cb: (err: any) => void
) {
  cb(null);
}

/**
 * Attaches a WebSocket server to an existing HTTP server.
 *
 * @param {Server} server - The HTTP server to attach the WebSocket server to.
 * @param {Config} config - The configuration object for the server.
 * @param {IDBFactory} [dbFactory=new DBFactory()] - The database factory to use for creating databases.
 * @param {FSNotify | null} [customFsNotify=null] - Custom file system notification handler.
 * @param {(req: IncomingMessage, token: string | null, cb: (err: any) => void) => void} [authenticate=noopAuth] - The authentication function.
 * @returns {DBCache} The database cache used by the WebSocket server.
 */
export function attachWebsocketServer(
  server: Server,
  config: Config,
  dbFactory: IDBFactory = new DBFactory(),
  customFsNotify: FSNotify | null = null,
  authenticate: (
    req: IncomingMessage,
    token: string | null,
    cb: (err: any) => void
  ) => void = noopAuth
): DBCache {
  // Determine the file system notification handler based on configuration
  let fsnotify: FSNotify | null;
  if (config.dbFolder == null) {
    console.warn(
      "In-memory databases cannot be listened to by other processes or replicas!"
    );
    fsnotify = null;
  } else {
    fsnotify = customFsNotify ?? new FSNotify(config);
  }
  const dbCache = new DBCache(config, fsnotify, dbFactory); // Create a new database cache instance
  const wss = new WebSocketServer({ noServer: true }); // Create a new WebSocket server instance

  server.on("upgrade", (request, socket, head) => {
    // Handle HTTP upgrade requests to WebSocket
    logger.info("upgrading to ws connection");
    const options = pullSecHeaders(request); // Extract protocol options from request headers
    authenticate(request, options.auth || null, (err) => {
      // Authenticate the request
      if (err) {
        logger.error("failed to authenticate");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); // Respond with 401 if authentication fails
        socket.destroy(); // Destroy the socket on authentication failure
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        // Handle WebSocket upgrade
        if (config.pathPattern.test(request.url || "")) {
          logger.info(`Upgraded to ws connection for ${request.url}`);
          wss.emit("connection", ws, request); // Emit connection event for valid WebSocket requests
        }
      });
    });
  });

  wss.on("connection", (ws: WebSocket, request) => {
    // Handle new WebSocket connections
    logger.info(`Connection opened`);

    const options = pullSecHeaders(request); // Extract protocol options from request headers
    if (!options.room) {
      console.error("Expected to receive a room in the sec-websocket-protocol");
      ws.close(); // Close WebSocket if room is not specified
      return;
    }
    new ConnectionBroker({
      // Create a new connection broker for managing the connection
      ws,
      dbCache,
      room: options.room,
    });
  });

  process.once("SIGINT", () => {
    // Handle SIGINT signal for graceful shutdown
    logger.info("SIGINT received, closing server");
    wss.close(); // Close WebSocket server on SIGINT
    return dbCache.destroy(); // Destroy database cache on shutdown
  });

  return dbCache;
}

/**
 * Extracts and parses the `sec-websocket-protocol` headers from an incoming request.
 *
 * @param {IncomingMessage} request - The incoming HTTP request.
 * @returns {Object} An object containing the parsed protocol options.
 * @throws Will throw an error if the `sec-websocket-protocol` header is missing.
 */
function pullSecHeaders(request: IncomingMessage) {
  const proto = request.headers["sec-websocket-protocol"]; // Get protocol header from request
  if (proto == null) {
    throw new Error("Expected sec-websocket-protocol header");
  }
  return parseSecHeader(proto); // Parse the protocol header into options
}

/**
 * Parses a `sec-websocket-protocol` header string into an object of key-value pairs.
 *
 * @param {string} proto - The protocol string to parse.
 * @returns {Object} An object containing the parsed protocol options.
 */
export function parseSecHeader(proto: string) {
  const entries = atob(proto).split(","); // Decode and split protocol string into entries
  const options: { [key: string]: string } = {}; // Initialize options object
  for (const entry of entries) {
    const [key, value] = entry.split("="); // Split each entry into key-value pairs
    options[key] = value;
  }
  return options; // Return the parsed options
}

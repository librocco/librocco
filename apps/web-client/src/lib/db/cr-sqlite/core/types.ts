import type { DBAsync } from "@vlcn.io/xplat-api";
export type { DBAsync, TXAsync, StmtAsync, TMutex, UpdateType } from "@vlcn.io/xplat-api";

export type { VFSWhitelist } from "./vfs";

export type TXCallback = Parameters<DBAsync["tx"]>[0];
export type OnUpdateCallback = Parameters<DBAsync["onUpdate"]>[0];

import type { DBAsync, TXAsync as _TXAsync } from "@vlcn.io/xplat-api";
export type { DBAsync, StmtAsync, TMutex, UpdateType } from "@vlcn.io/xplat-api";

/**
 * A TXAsync type without the `tx.tx` method - we're using this adjusted type to ensure that functions
 * that call to `db.tx` don't accept `TXAsync` as `db` (ensuring we don't nest transactions).
 */
export type TXAsync = Omit<_TXAsync, "tx">;

export type { VFSWhitelist } from "./vfs";

export type TXCallback = Parameters<DBAsync["tx"]>[0];
export type OnUpdateCallback = Parameters<DBAsync["onUpdate"]>[0];

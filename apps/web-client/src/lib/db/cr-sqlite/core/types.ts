import type { TXAsync as _TXAsync } from "@vlcn.io/xplat-api";
export type { DBAsync } from "@vlcn.io/xplat-api";

/**
 * A TXAsync type without the `tx.tx` method - we're using this adjusted type to ensure that functions
 * that call to `db.tx` don't accept `TXAsync` as `db` (ensuring we don't nest transactions).
 */
export type TXAsync = Omit<_TXAsync, "tx">;

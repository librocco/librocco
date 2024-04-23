type EmptyResult = { ok: boolean };
/**
 * Yes, this is inspired by Rust's 'Result' enum - easier to write a generic function (e.g. 'listenWithTimeout') with
 * a consistent (generic) return type.
 */
export type Result<T> = T extends null ? EmptyResult : { ok: true; data: T } | { ok: false };

/**
 * This is a placeholder as we're not using the generic DB, this might change as we add schema, but trying to keep this as a single source of truth
 */
export { type DB } from "@vlcn.io/crsqlite-wasm";

export type Customer = {
	id?: number;
	fullname?: string;
	email?: string;
	deposit?: number;
};

export type CustomerOrderLine = { id: number; isbn: string; quantity: number };
export type Book = { isbn: string; quantity: number };
/* These have been lifted from https://github.com/vlcn-io/js/blob/main/packages/direct-connect-common/src/types.ts
I was unabe to import it from there.
*/

export type Seq = readonly [bigint, number];

export type CID = string;
export type PackedPks = Uint8Array;
export type TableName = string;
export type Version = bigint;
export type CausalLength = bigint;
export type Val = any;

export type Change = readonly [
	TableName,
	PackedPks,
	CID,
	Val,
	Version, // col version
	Version, // db version
	// site_id is omitted. Will be applied by the receiver
	// who always knows site ids in client-server setup.
	// server masks site ids of clients. This masking
	// is disallowed in p2p topologies.
	CausalLength,
	number // seq
];

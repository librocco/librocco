import type { Src, TblRx } from "@vlcn.io/rx-tbl";
import tblrx from "@vlcn.io/rx-tbl";
import type { DBAsync, UpdateType } from "@vlcn.io/xplat-api";

export interface IAppDbRx {
	onPoint: TblRx["onPoint"];
	onRange: TblRx["onRange"];
	onAny: TblRx["onAny"];

	onInvalidate(cb: () => void): () => void;
	invalidate(db: DBAsync): void;
}

type RxListenerPoint = {
	_kind: "point";
	table: string;
	rowid: bigint;
	cb: (updates: UpdateType[]) => void;
	unsubscribe: () => void;
};

type RxListenerRange = {
	_kind: "range";
	tables: string[];
	cb: (updates: UpdateType[]) => void;
	unsubscribe: () => void;
};

type RxListenerAny = {
	_kind: "any";
	cb: (updates: UpdateType[], src: Src) => void;
	unsubscribe: () => void;
};

type RxListener = RxListenerPoint | RxListenerRange | RxListenerAny;

class RxListenerManager {
	#listeners = new Map<string, RxListener>();

	set(id: string, listener: RxListener) {
		this.#listeners.set(id, listener);
	}

	private _unsubscribeSafe(id: string) {
		try {
			this.#listeners.get(id)?.unsubscribe();
		} catch {
			// Swallow for now -- I can't see different case than underlaying
			// rx object being out of scope -- noop anyway
		}
	}

	unsubscribe(id: string) {
		this._unsubscribeSafe(id);
		this.#listeners.delete(id);
	}

	/**
	 * Transfer all subscriptions to a new TblRx object. We use this to keep the same subscriptions
	 * (table, range, point, etc.) even when the current DB (and respective TblRx object) changes:
	 * - the active subscribers are simply transferred to the next TblRx
	 * - all downstream notifications (from the new TblRx) are relayed in the same way as if nothing had changed
	 * - the consumer (subscriber) doesn't have to care which DB it's subscribing to: it subscribes to (e.g.) a range
	 *   and the same range-related notifications flow back to the subscriber
	 */
	transferToNewRx(next: TblRx | null) {
		for (const [id, listener] of this.#listeners.entries()) {
			this._unsubscribeSafe(id);
			switch (listener._kind) {
				case "point": {
					const { _kind, table, rowid, cb } = listener;
					const unsubscribe = next?.onPoint(table, rowid, cb) || (() => {});
					this.set(id, { _kind, table, rowid, cb, unsubscribe });
					break;
				}
				case "range": {
					const { _kind, tables, cb } = listener;
					const unsubscribe = next?.onRange(tables, cb) || (() => {});
					this.set(id, { _kind, tables, cb, unsubscribe });
					break;
				}
				case "any": {
					const { _kind, cb } = listener;
					const unsubscribe = next?.onAny(cb) || (() => {});
					this.set(id, { _kind, cb, unsubscribe });
					break;
				}
			}
		}
	}
}

export class AppDbRx implements IAppDbRx {
	#db: DBAsync | null;
	#internal: TblRx | null;

	#invalidateListeners = new Set<() => void>();
	#rxListeners = new RxListenerManager();

	onPoint(table: string, rowid: bigint, cb: (updates: UpdateType[]) => void): () => void {
		const id = Math.floor(Math.random() * 100_000).toString();
		const unsubscribe = this.#internal?.onPoint(table, rowid, cb) || (() => {});
		this.#rxListeners.set(id, { _kind: "point", table, rowid, cb, unsubscribe });
		return () => this.#rxListeners.unsubscribe(id);
	}

	onRange(tables: string[], cb: (updates: UpdateType[]) => void): () => void {
		const id = Math.floor(Math.random() * 100_000).toString();
		const unsubscribe = this.#internal?.onRange(tables, cb) || (() => {});
		this.#rxListeners.set(id, { _kind: "range", tables, cb, unsubscribe });
		return () => this.#rxListeners.unsubscribe(id);
	}

	onAny(cb: (updates: UpdateType[], src: Src) => void): () => void {
		const id = Math.floor(Math.random() * 100_000).toString();
		const unsubscribe = this.#internal?.onAny(cb) || (() => {});
		this.#rxListeners.set(id, { _kind: "any", cb, unsubscribe });
		return () => this.#rxListeners.unsubscribe(id);
	}

	/**
	 * Invalidate the Rx object. Use this when the currently active DB is changed to:
	 * - transfer subscriptions from old TblRx object to the new one
	 * - notify subscribers that the DB was invalidated (e.g. DB changed completely and they should requery)
	 */
	invalidate(db: DBAsync) {
		for (const cb of this.#invalidateListeners) {
			cb();
		}

		if (db != this.#db) {
			this.#db = db;
			this.#internal = tblrx(db);
			this.#rxListeners.transferToNewRx(this.#internal);
		}
	}

	onInvalidate(cb: () => void): () => void {
		this.#invalidateListeners.add(cb);
		return () => {
			this.#invalidateListeners.delete(cb);
		};
	}
}

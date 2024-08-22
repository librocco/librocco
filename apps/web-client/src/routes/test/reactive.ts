import { Kysely, type SelectQueryBuilder } from "kysely";

export class SubsMap {
	#subscriptions = new Map<string, Set<string>>();
	#subscribers = new Map<string, () => void>();

	private _unsubscribe(id: string) {
		this.#subscribers.delete(id);
	}

	subscribe(tables: string[], notify: () => void, subscriberPrefix = "") {
		const id = [subscriberPrefix, Date.now().toString(36)].join("_");
		this.#subscribers.set(id, notify);

		for (const table of tables) {
			const subscribers = this.#subscriptions.get(table) || this.#subscriptions.set(table, new Set()).get(table)!;
			subscribers.add(id);
		}

		return () => this._unsubscribe(id);
	}

	notify(table: string) {
		const subscriberIds = this.#subscriptions.get(table) || new Set();

		for (const id of subscriberIds) {
			const notify = this.#subscribers.get(id);
			// If no subscriber registered, remove the subscription
			if (!notify) {
				subscriberIds.delete(id);
				continue;
			}

			notify();
		}
	}
}

const wrapQueryBuilder = <T extends SelectQueryBuilder<any, any, any>>(qb: T, tables: string[]): WrappedQueryBuilder<T> => {
	const _fullJoin = qb.fullJoin.bind(qb);
	const fullJoin = (...params: Parameters<T["fullJoin"]>) => {
		const [identifier] = params;
		const [table] = identifier.toString().split(" ");
		return wrapQueryBuilder(_fullJoin(...params), [...tables, table]);
	};

	const _leftJoin = qb.leftJoin.bind(qb);
	const leftJoin = (...params: Parameters<T["leftJoin"]>) => {
		const [identifier] = params;
		const [table] = identifier.toString().split(" ");
		return wrapQueryBuilder(_leftJoin(...params), [...tables, table]);
	};

	const _rightJoin = qb.rightJoin.bind(qb);
	const rightJoin = (...params: Parameters<T["rightJoin"]>) => {
		const [identifier] = params;
		const [table] = identifier.toString().split(" ");
		return wrapQueryBuilder(_rightJoin(...params), [...tables, table]);
	};

	const _innerJoin = qb.innerJoin.bind(qb);
	const innerJoin = (...params: Parameters<T["innerJoin"]>) => {
		const [identifier] = params;
		const [table] = identifier.toString().split(" ");
		return wrapQueryBuilder(_innerJoin(...params), [...tables, table]);
	};

	const getTables = () => [...new Set(tables)];

	return Object.assign(qb, { leftJoin, rightJoin, innerJoin, fullJoin, getTables });
};

type WrappedQueryBuilder<T extends SelectQueryBuilder<any, any, any>> = T & {
	getTables: () => string[];
};

export const wrapKysely = <T extends Kysely<any>>(kysely: T): T => {
	const _selectFrom = kysely.selectFrom.bind(kysely);
	const selectFrom = (...params: Parameters<T["selectFrom"]>) => {
		const [identifier] = params;
		const [table] = identifier.toString().split(" ");
		const qb = _selectFrom(...params);
		return wrapQueryBuilder(qb, [table]);
	};

	return Object.assign(kysely, { selectFrom });
};

export const createReactive =
	<K extends Kysely<any>>(db: K) =>
	<QB extends ReturnType<K["selectFrom"]>>(qb: (db: Kysely<any>) => QB) => {
		const _qb = qb(wrapKysely(db));
		const tables = (_qb as WrappedQueryBuilder<QB>).getTables();
		console.log(tables);
	};

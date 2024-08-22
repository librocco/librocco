import {
	AggregateFunctionNode,
	AliasNode,
	ColumnNode,
	Kysely,
	RawNode,
	ReferenceNode,
	SelectAllNode,
	SelectQueryNode,
	TableNode,
	type CompiledQuery
} from "kysely";
import { Observable } from "rxjs";

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

export const createReactive = <K extends Kysely<any>>(db: K, subsMap = new SubsMap()) => {
	return {
		notify: subsMap.notify.bind(subsMap) as SubsMap["notify"],
		replicated: <S extends Selectable<any>>(qb: (db: Kysely<any>) => S, idPrefix = "") => {
			const q = qb(db);
			const tables = affectedTables(q.toOperationNode());

			return new Observable<Awaited<ReturnType<S["execute"]>>>((s) => {
				s.next(undefined);
				const executeQuery = () => q.execute().then(s.next.bind(s));
				executeQuery();
				return subsMap.subscribe(tables, executeQuery, idPrefix);
			});
		}
	};
};

/**
 * Note: the following code was shamelssly copied from the crstore library:
 * https://github.com/Azarattum/CRStore
 */
type Selectable<T> = {
	execute(): Promise<T>;
	compile(): CompiledQuery;
	toOperationNode(): SelectQueryNode;
};

/**
 * Note: the following code was shamelssly copied from the crstore library:
 * https://github.com/Azarattum/CRStore
 */
type Node = SelectQueryNode | TableNode | ColumnNode | ReferenceNode | RawNode | AggregateFunctionNode | AliasNode | SelectAllNode;

/**
 * Parses a query node and retrieves the affected tables - we're using this to determine which updates should
 * trigger a re-query (for reactive subscriptions)
 *
 * Note: the following code was shamelssly copied from the crstore library:
 * https://github.com/Azarattum/CRStore
 * @param target
 * @returns
 */
function affectedTables(target: Node): string[] {
	// if (typeof target === "string") {
	// 	return [...new Set(decode(target).map((x) => x.table))];
	// }
	if (target.kind === "TableNode") {
		return [target.table.identifier.name];
	}
	if (target.kind === "ReferenceNode" && target.table) {
		return [target.table.table.identifier.name];
	}
	if (target.kind === "AliasNode") {
		return affectedTables(target.node as Node);
	}
	if (target.kind === "SelectQueryNode") {
		const tables = (
			[
				...(target.from?.froms || []),
				...(target.joins?.map((x) => x.table) || []),
				...(target.selections?.map((x) => x.selection) || []),
				...(target.with?.expressions.map((x) => x.expression) || [])
			] as Node[]
		).flatMap(affectedTables);
		return [...new Set(tables)];
	}
	return [];
}

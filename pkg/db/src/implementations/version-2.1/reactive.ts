import {
	AggregateFunctionNode,
	AliasNode,
	ColumnNode,
	Kysely,
	RawNode,
	ReferenceNode,
	SelectAllNode,
	SelectQueryNode,
	TableNode
} from "kysely";
import { Observable } from "rxjs";

import { debug } from "@librocco/shared";

import { LogLevel } from "@/types";
import { Selectable, SelectedStream } from "./types";
import { uniqueTimestamp } from "@/utils/misc";

type NotifyFn = (table: string) => void;

export class SubsMap {
	#subscriptions = new Map<string, Set<string>>();
	#subscribers = new Map<string, NotifyFn>();

	private _unsubscribe(ctx: debug.DebugCtx, id: string) {
		debug.log(ctx, "reactive: unsubscribe: id")(id);
		this.#subscribers.delete(id);
		debug.log(ctx, "reactive: unsubscribe: subscribers")(`[ ${[...this.#subscribers.keys()].join(",\n  ")} ]`);
	}

	subscribe(ctx: debug.DebugCtx, tables: string[], notify: NotifyFn, subscriberPrefix = "") {
		const id = [subscriberPrefix, uniqueTimestamp()].join("_");
		debug.log(ctx, "reactive: subscribe: id")(id);
		this.#subscribers.set(id, notify);
		debug.log(ctx, "reactive: subscribe: subscribers")(`[ ${[...this.#subscribers.keys()].join(",\n  ")} ]`);

		debug.log(ctx, "reactive: subscribe: tables")(`[ ${tables.join(", ")} ]`);
		debug.log(ctx, "reactive: subscribe: existing tables")(`[ ${[...this.#subscriptions.keys()].join(",\n  ")} ]`);
		for (const table of tables) {
			const subscribers = this.#subscriptions.get(table) || this.#subscriptions.set(table, new Set()).get(table)!;
			subscribers.add(id);
		}
		debug.log(ctx, "reactive: subscribe: updated tables:")(`[ ${[...this.#subscriptions.keys()].join(",\n  ")} ]`);

		return () => this._unsubscribe(ctx, id);
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
			notify(table);
		}
	}
}
export const createReactive = <K extends Kysely<any>>(db: K, subsMap = new SubsMap(), logLevel: LogLevel = "none") => {
	const timeLogger = newTimeLogger(logLevel);

	return {
		notify: subsMap.notify.bind(subsMap) as SubsMap["notify"],
		stream: <S extends Selectable<any>>(ctx: debug.DebugCtx, qb: (db: K) => S, idPrefix = ""): SelectedStream<S> => {
			const q = qb(db);
			const tables = affectedTables(q.toOperationNode());

			return new Observable<Awaited<ReturnType<S["execute"]>>>((s) => {
				const executeQuery = (table: string) => {
					debug.log(ctx, "reactive:notify:table")(table);
					const logId = uniqueTimestamp();
					timeLogger.start(q, logId);
					q.execute()
						.then((x) => x || [])
						.then((x) => (timeLogger.end(q, logId), x))
						.then(s.next.bind(s));
				};
				executeQuery("INITIAL");
				return subsMap.subscribe(ctx, tables, executeQuery, idPrefix);
			});
		}
	};
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

const newTimeLogger = (logLevel: LogLevel) => {
	const seen = {
		start: new Map<string, boolean>(),
		end: new Map<string, boolean>()
	};

	const _log = (kind: "start" | "end") => (query: Selectable<any>, id: string) => {
		const _logKind = (logId: string) => (kind === "start" ? console.time(logId) : console.timeEnd(logId));

		// Don't log anything
		if (logLevel === "none") return;

		const queryStr = query.compile().sql;
		const logId = [queryStr, id].join("::");

		// If log level == "debug" log every time
		if (logLevel === "debug") return _logKind(logId);

		// If log level == "log" log every query only once
		if (seen[kind].get(queryStr)) return;
		seen[kind].set(queryStr, true);
		return _logKind(logId);
	};

	const start = _log("start");
	const end = _log("end");

	return { start, end };
};

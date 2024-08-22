<script lang="ts">
	import { SQLocal } from "sqlocal";
	import { SQLocalKysely } from "sqlocal/kysely";
	import { Kysely, type SelectQueryBuilder } from "kysely";
	import { onMount } from "svelte";
	import type { Schema } from "./schema";
	import { derived, readable, type Readable } from "svelte/store";
	import { createReactive, wrapKysely } from "./reactive";

	class SubsMap {
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

	onMount(async () => {
		const { dialect, sql, createCallbackFunction } = new SQLocalKysely("database.sqlite3");
		const db = new Kysely<Schema>({ dialect });

		window["ks"] = wrapKysely(db);
		window["stream"] = createReactive(db);

		await Promise.all([
			sql`CREATE TABLE IF NOT EXISTS warehouses (id INTEGER PRIMARY KEY AUTOINCREMENT, displayName TEXT)`,
			sql`CREATE TEMP TRIGGER logWarehouseInsert AFTER INSERT ON warehouses BEGIN SELECT logInsert('warehouses', new.displayName); END`
		]);
		sql`SELECT * FROM warehouses`.then(console.log);

		// Reactive
		const subs = new SubsMap();

		// const replicated = <Table extends keyof Schema, Res>(
		// 	buildQuery: (db: Kysely<Schema>) => SelectQueryBuilder<Schema, Table, Res>
		// ): Readable<Res> => {
		// 	const queryNode = buildQuery(db).toOperationNode();
		// 	queryNode.from.froms.map((n) => (n.kind === "TableNode" ? (n as { kind: string; table: string }).table : ""));
		// };
		// const x = replicated((db) => db.selectFrom("warehouses").select(["id", "displayName"]));
	});

	let msg = "gg";
</script>

<h1>{msg}</h1>

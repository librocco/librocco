<script lang="ts">
	import { browser } from "$app/environment";
	import Plus from "$lucide/plus";
	import RotateCcw from "$lucide/rotate-ccw";
	import Play from "$lucide/play";
	import BookPlus from "$lucide/book-plus";
	import AlertTriangle from "$lucide/alert-triangle";
	import Unplug from "$lucide/unplug";
	import Download from "$lucide/download";

	import { onMount } from "svelte";

	import { get } from "svelte/store";

	import { wrapIter } from "@librocco/shared";

	import type { LayoutData } from "../$types";

	import { upsertBook } from "$lib/db/cr-sqlite/books";
	import {
		createReconciliationOrder,
		finalizeReconciliationOrder,
		upsertReconciliationOrderLines
	} from "$lib/db/cr-sqlite/order-reconciliation";
	import { associatePublisher, createSupplierOrder, upsertSupplier } from "$lib/db/cr-sqlite/suppliers";
	import { addBooksToCustomer, upsertCustomer } from "$lib/db/cr-sqlite/customers";
	import { schemaVersion } from "$lib/db/cr-sqlite/db";

	import { goto } from "$lib/utils/navigation";
	import { exportStateArchive } from "$lib/utils/debug-export";
	import { toastError, toastSuccess } from "$lib/components/Melt/Toaster.svelte";

	import { debugData as dd } from "$lib/__testData__/debugData";
	import { LL } from "@librocco/shared/i18n-svelte";

	import { app, nukeAndResyncDb } from "$lib/app";
	import { startSync, stopSync } from "$lib/app/sync";
	import { getDb, getVfs } from "$lib/app/db";
	import { Page } from "$lib/controllers";
	import { syncConnectivityMonitor } from "$lib/stores";
	import { localDbHealth, runLocalDbIntegrityCheck, runLocalDbQuickCheck } from "$lib/stores/local-db-health";
	import { pendingChangesCount, pendingChangesLastActiveAt, pendingChangesSince } from "$lib/stores/sync-pending";
	import {
		markAutoRecoveryAttempt,
		markAutoRecoveryFailure,
		markAutoRecoveryNoop,
		markAutoRecoverySuccess,
		syncAutoRecovery
	} from "$lib/stores/sync-auto-recovery";
	import { resetSyncRuntimeHealth, syncRuntimeHealth } from "$lib/stores/sync-runtime-health";
	import { checkSyncCompatibility, resetSyncCompatibility, syncCompatibility } from "$lib/stores/sync-compatibility";

	export let data: LayoutData;
	$: ({ plugins } = data);

	let isLoading = true;

	let query = "SELECT * FROM book LIMIT 10;";
	let queryResult = null;
	let errorMessage = null;
	const syncConnected = syncConnectivityMonitor.connected;
	const syncStuck = syncConnectivityMonitor.stuck;
	const syncConnDiagnostics = syncConnectivityMonitor.diagnostics;
	const syncUrlConfig = app.config.syncUrl;

	const TABLE_PREVIEW_LIMIT = 200;
	const localSchemaVersionLabel = String(schemaVersion);

	type ExplorerTableSummary = {
		name: string;
	};

	let tableExplorerData: ExplorerTableSummary[] = [];
	let selectedExplorerTable: string | null = null;
	let selectedExplorerTableRows: Record<string, unknown>[] = [];
	let selectedExplorerTableRowCount = 0;
	let isTableLoading = false;
	let nowTs = Date.now();

	type TimelineSeverity = "info" | "warning" | "error" | "success";
	type TimelineEntry = {
		at: number;
		severity: TimelineSeverity;
		message: string;
	};
	type MetaProbeResult = {
		ok: boolean;
		url: string;
		latencyMs: number;
		status?: number;
		error?: string;
		bodySnippet?: string;
	};
	type WsProbeResult = {
		ok: boolean;
		url: string;
		latencyMs: number;
		closeCode?: number;
		closeReason?: string;
		error?: string;
	};
	type ConnectionProbeResult = {
		at: number;
		syncActive: boolean;
		dbid: string;
		syncUrl: string;
		meta: MetaProbeResult;
		ws: WsProbeResult;
	};
	type HandshakeStatusCheckResult = {
		at: number;
		ok: boolean;
		stage?: string;
		reason?: string;
		message?: string;
		ackDbVersion?: number;
		siteId?: string;
		schemaVersion?: string;
		timedOut: boolean;
	};
	type SyncConfigSanityResult = {
		at: number;
		syncActive: boolean;
		dbid: string;
		syncUrl: string;
		metaUrl: string | null;
		wsUrlOk: boolean;
		problems: string[];
	};
	const TIMELINE_LIMIT = 5;
	const TIMELINE_STORAGE_KEY = "librocco-debug-sync-timeline";
	let diagnosticsTimeline: TimelineEntry[] = [];
let connectionProbe: ConnectionProbeResult | null = null;
let isRunningConnectionProbe = false;
let handshakeStatusCheck: HandshakeStatusCheckResult | null = null;
let syncConfigSanity: SyncConfigSanityResult | null = null;
let isRunningHandshakeCheck = false;
let isRunningSanityCheck = false;
	let lastConnectivitySig = "";
	let lastCompatibilitySig = "";
	let lastLocalDbSig = "";
	let lastPendingSig = "";
	let lastAutoRecoverySig = "";

	const quoteIdentifier = (identifier: string) => `"${identifier.replace(/"/g, "\"\"")}"`;

	const fmtAge = (ts: number | null, now: number) => {
		if (!ts) return $LL.debug_page.health_rail.never();
		const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
		if (diffSec < 60) return `${diffSec}s ago`;
		const min = Math.floor(diffSec / 60);
		const sec = diffSec % 60;
		return `${min}m ${sec}s ago`;
	};

	const fmtTs = (ts: number | null) => {
		if (!ts) return $LL.debug_page.health_rail.never();
		return new Date(ts).toLocaleTimeString();
	};

	const pushTimeline = (message: string, severity: TimelineSeverity = "info") => {
		diagnosticsTimeline = [{ at: Date.now(), severity, message }, ...diagnosticsTimeline].slice(0, TIMELINE_LIMIT);
		if (browser) {
			sessionStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(diagnosticsTimeline));
		}
	};

	const toneClass = (severity: TimelineSeverity) => {
		if (severity === "error") return "text-red-800 bg-red-100 border-red-300";
		if (severity === "warning") return "text-amber-900 bg-amber-100 border-amber-300";
		if (severity === "success") return "text-emerald-900 bg-emerald-100 border-emerald-300";
		return "text-base-content bg-base-100 border-base-300";
	};

	const formatUiLabel = (value: string | null | undefined) => {
		if (!value) return $LL.debug_page.health_rail.none();
		return value
			.replace(/_/g, " ")
			.replace(/\b\w/g, (char) => char.toUpperCase());
	};

	const buildMetaProbeUrl = (syncUrl: string, dbid: string) => {
		const url = new URL(syncUrl);
		if (url.protocol === "ws:") url.protocol = "http:";
		if (url.protocol === "wss:") url.protocol = "https:";
		url.pathname = `/${dbid}/meta`;
		url.search = "";
		url.hash = "";
		return url.toString();
	};

	let connectionTone: TimelineSeverity = "warning";
	let compatibilityTone: TimelineSeverity = "warning";
	let localDbTone: TimelineSeverity = "warning";
	let pendingTone: TimelineSeverity = "success";
	type FreshnessLevel = "ok" | "warn" | "error" | "na";
	const statusWarnSec = 3;
	const statusErrorSec = 10;
	const ackWarnSec = 45;
	const ackErrorSec = 120;
	const queueWarnSec = 60;
	const queueErrorSec = 120;

	const ageLevel = (ageSec: number | null, warnSec: number, errorSec: number): FreshnessLevel => {
		if (ageSec == null) return "na";
		if (ageSec >= errorSec) return "error";
		if (ageSec >= warnSec) return "warn";
		return "ok";
	};

	const levelLabel = (level: FreshnessLevel) => {
		if (level === "ok") return $LL.debug_page.freshness.healthy();
		if (level === "warn") return $LL.debug_page.freshness.warning();
		if (level === "error") return $LL.debug_page.freshness.stale();
		return $LL.debug_page.freshness.na();
	};

	const levelClass = (level: FreshnessLevel) => {
		if (level === "ok") return "text-emerald-900 bg-emerald-100 border-emerald-300";
		if (level === "warn") return "text-amber-900 bg-amber-100 border-amber-300";
		if (level === "error") return "text-red-800 bg-red-100 border-red-300";
		return "text-base-content bg-base-100 border-base-300";
	};

	const levelProgressClass = (level: FreshnessLevel) => {
		if (level === "ok") return "progress-success";
		if (level === "warn") return "progress-warning";
		if (level === "error") return "progress-error";
		return "progress-neutral";
	};

	const healthPct = (ageSec: number | null, errorSec: number) => {
		if (ageSec == null) return 0;
		return Math.max(0, 100 - Math.min(100, (ageSec / errorSec) * 100));
	};

	$: connectionViaOtherTab = !$syncConnected && statusAgeSec != null && statusAgeSec <= 15;
	$: connectionTone = $syncStuck ? "error" : $syncConnected || connectionViaOtherTab ? "success" : "error";
	$: compatibilityTone =
		$syncCompatibility.status === "incompatible"
			? "error"
			: $syncCompatibility.status === "compatible"
				? "success"
				: "warning";
	$: localDbTone = $localDbHealth.status === "error" ? "error" : $localDbHealth.status === "ok" ? "success" : "warning";
	$: pendingTone = $pendingChangesCount > 0 ? "warning" : "success";
	$: statusHeartbeatAt = $syncConnected
		? nowTs
		: ($syncConnDiagnostics.disconnectedSince ??
			$syncConnDiagnostics.lastCloseTime ??
			$syncRuntimeHealth.lastStatusAt ??
			$syncRuntimeHealth.lastAckAt ??
			null);
	$: statusAgeSec = statusHeartbeatAt ? Math.max(0, Math.floor((nowTs - statusHeartbeatAt) / 1000)) : null;
	$: ackAgeSec = $syncRuntimeHealth.lastAckAt ? Math.max(0, Math.floor((nowTs - $syncRuntimeHealth.lastAckAt) / 1000)) : null;
	$: pendingAgeSec = $pendingChangesSince ? Math.max(0, Math.floor((nowTs - $pendingChangesSince) / 1000)) : null;
	$: statusFreshnessLevel = ageLevel(statusAgeSec, statusWarnSec, statusErrorSec);
	$: ackFreshnessLevel = $pendingChangesCount > 0 ? ageLevel(ackAgeSec, ackWarnSec, ackErrorSec) : "na";
	$: queueFreshnessLevel = $pendingChangesCount > 0 ? ageLevel(pendingAgeSec, queueWarnSec, queueErrorSec) : "na";
	$: statusHealthPct = healthPct(statusAgeSec, statusErrorSec);
	$: ackHealthPct = $pendingChangesCount > 0 ? healthPct(ackAgeSec, ackErrorSec) : 0;
	$: queueHealthPct = $pendingChangesCount > 0 ? healthPct(pendingAgeSec, queueErrorSec) : 0;

	$: {
		const sig = `${$syncConnected}|${$syncStuck}|${$syncConnDiagnostics.reason || ""}`;
		if (lastConnectivitySig && sig !== lastConnectivitySig) {
			pushTimeline(
				$syncStuck
					? $LL.debug_page.timeline_events.connection_stuck({ reason: String($syncConnDiagnostics.reason || $LL.debug_page.checks.na()) })
					: $syncConnected
						? $LL.debug_page.timeline_events.connection_restored()
						: $LL.debug_page.timeline_events.connection_lost(),
				$syncStuck ? "warning" : $syncConnected ? "success" : "error"
			);
		}
		lastConnectivitySig = sig;
	}

	$: {
		const sig = `${$syncCompatibility.status}|${$syncCompatibility.status === "incompatible" ? $syncCompatibility.reason : ""}`;
		if (lastCompatibilitySig && sig !== lastCompatibilitySig) {
			pushTimeline(
				$syncCompatibility.status === "incompatible"
					? $LL.debug_page.timeline_events.compatibility_issue({ reason: String($syncCompatibility.reason) })
					: $LL.debug_page.timeline_events.compatibility_state({ status: String($syncCompatibility.status) }),
				$syncCompatibility.status === "incompatible" ? "error" : "info"
			);
		}
		lastCompatibilitySig = sig;
	}

	$: {
		const sig = `${$localDbHealth.status}|${$localDbHealth.message || ""}`;
		if (lastLocalDbSig && sig !== lastLocalDbSig) {
			pushTimeline(
				$localDbHealth.status === "ok"
					? $LL.debug_page.timeline_events.local_db_health_passed()
					: $LL.debug_page.timeline_events.local_db_health_status({ status: String($localDbHealth.status) }),
				$localDbHealth.status === "error" ? "error" : $localDbHealth.status === "ok" ? "success" : "warning"
			);
		}
		lastLocalDbSig = sig;
	}

	$: {
		const sig = String($pendingChangesCount);
		if (lastPendingSig && sig !== lastPendingSig) {
			pushTimeline(
				$pendingChangesCount > 0
					? $LL.debug_page.timeline_events.pending_changes({ count: $pendingChangesCount })
					: $LL.debug_page.timeline_events.pending_queue_drained(),
				$pendingChangesCount > 0 ? "warning" : "success"
			);
		}
		lastPendingSig = sig;
	}

	$: {
		const sig = `${$syncAutoRecovery.lastAttemptAt || ""}|${$syncAutoRecovery.lastResult || ""}|${$syncAutoRecovery.lastError || ""}`;
		if (lastAutoRecoverySig && sig !== lastAutoRecoverySig && $syncAutoRecovery.lastAttemptAt) {
			pushTimeline(
				$syncAutoRecovery.lastError
					? $LL.debug_page.timeline_events.auto_recovery_with_error({
							result: String($syncAutoRecovery.lastResult || $LL.debug_page.checks.na()),
							error: String($syncAutoRecovery.lastError)
						})
					: $LL.debug_page.timeline_events.auto_recovery({ result: String($syncAutoRecovery.lastResult || $LL.debug_page.checks.na()) }),
				$syncAutoRecovery.lastResult === "failure"
					? "error"
					: $syncAutoRecovery.lastResult === "success"
						? "success"
						: "info"
			);
		}
		lastAutoRecoverySig = sig;
	}

	const loadExplorerTablePreview = async (tableName: string) => {
		isTableLoading = true;
		errorMessage = null;
		try {
			const db = await getDb(app);
			const quoted = quoteIdentifier(tableName);
			const [{ count }] = await db.execO<{ count: number }>(`SELECT COUNT(*) as count FROM ${quoted}`);
			const rows = await db.execO<Record<string, unknown>>(`SELECT * FROM ${quoted} LIMIT ${TABLE_PREVIEW_LIMIT}`);

			selectedExplorerTable = tableName;
			selectedExplorerTableRowCount = Number(count ?? 0);
			selectedExplorerTableRows = rows;
		} catch (error) {
			console.error("Error loading table preview:", error);
			errorMessage = error;
		} finally {
			isTableLoading = false;
		}
	};

	const handleExplorerTableChange = async (e: Event) => {
		const target = e.currentTarget as HTMLSelectElement | null;
		const tableName = target?.value;
		if (!tableName) {
			selectedExplorerTable = null;
			selectedExplorerTableRows = [];
			selectedExplorerTableRowCount = 0;
			return;
		}
		await loadExplorerTablePreview(tableName);
	};

	// Function to generate random ISBN (10 digits)
	function generateRandomISBN() {
		return Math.floor(1000000000 + Math.random() * 9000000000).toString();
	}

	// Function to generate a random price between $5 and $50
	function generateRandomPrice() {
		return (5 + Math.random() * 45).toFixed(2);
	}
	// Function to generate deterministic ISBN based on index
	function generateDeterministicISBN(index) {
		// Pad the index to 10 digits with leading zeros
		return `9780000${index.toString().padStart(5, "0")}`;
	}

	// Function to generate deterministic price based on index
	function generateDeterministicPrice(index) {
		// Price between $10 and $50 based on index
		return (10 + (index % 41)).toFixed(2);
	}

	// Function to upsert 100 books with different publishers
	async function upsert100Books() {
		isLoading = true;
		errorMessage = null;

		const db = await getDb(app);

		try {
			// Create an array of 100 book objects with deterministic values
			const books = Array.from({ length: 100 }, (_, i) => {
				const bookNumber = i + 1;
				return {
					isbn: generateDeterministicISBN(bookNumber),
					title: `Test Book ${bookNumber}`,
					authors: `Author ${bookNumber}`,
					publisher: `Publisher ${bookNumber}`,
					price: generateDeterministicPrice(bookNumber),
					year: 2023
				};
			});

			// Insert each book
			for (const book of books) {
				await db.exec(`
                     INSERT INTO book (isbn, title, authors, publisher, price, year)
                     VALUES (
                         '${book.isbn}',
                         '${book.title}',
                         '${book.authors}',
                         '${book.publisher}',
                         ${book.price},
                         ${book.year}
                     )
                     ON CONFLICT(isbn) DO UPDATE SET
                         title = '${book.title}',
                         authors = '${book.authors}',
                         publisher = '${book.publisher}',
                         price = ${book.price},
                         year = ${book.year}
                 `);
			}

			// Also create supplier entries for each publisher with deterministic ID
			for (let i = 1; i <= 100; i++) {
				const supplierId = i;
				const publisherName = `Publisher ${i}`;

				// Insert supplier
				await db.exec(`
                     INSERT INTO supplier (id, name, email, address, customerId)
                     VALUES (
                         ${supplierId},
                         '${publisherName} Distribution',
                         'contact@${publisherName.toLowerCase().replace(/\s+/g, "")}.com',
                         '${i} Publisher Street, Book City',
                         ${supplierId}${i}
                     )
                     ON CONFLICT(id) DO UPDATE SET
                         name = '${publisherName} Distribution',
                         email = 'contact@${publisherName.toLowerCase().replace(/\s+/g, "")}.com',
                         address = '${i} Publisher Street, Book City',
                         customerId = ${supplierId}${i}
                 `);

				// Link publisher to supplier
				await db.exec(`
                     INSERT INTO supplier_publisher (supplier_id, publisher)
                     VALUES (${supplierId}, '${publisherName}')
                     ON CONFLICT(publisher) DO NOTHING
                 `);
			}

			console.log("Successfully upserted 100 books with different publishers");
		} catch (error) {
			console.error("Error upserting books:", error);
			errorMessage = error;
		} finally {
			isLoading = false;
			await loadData();
		}
	}

	const populateDatabase = async function () {
		errorMessage = null;
		console.log("Populating database");

		const db = await getDb(app);

		try {
			// Books
			for (const book of dd.books) {
				await upsertBook(db, book);
			}

			// Customers
			for (const customer of dd.customers) {
				await upsertCustomer(db, customer);
			}

			// Group order lines by customer_id for quicker (batched) updates
			const customerOrderLines = wrapIter(dd.customerOrderLines)._groupIntoMap(({ customer_id, isbn }) => [customer_id, isbn]);
			// Add supplier order lines to their respective customer orders
			for (const [customer_id, isbns] of customerOrderLines.entries()) {
				await addBooksToCustomer(db, customer_id, [...isbns]);
			}

			// Suppliers
			for (const supplier of dd.suppliers) {
				await upsertSupplier(db, supplier);
			}

			for (const { supplierId, publisher } of dd.supplierPublishers) {
				await associatePublisher(db, supplierId, publisher);
			}

			// Group supplier order lines by supplier orders
			const supplierOrderMap = wrapIter(dd.supplierOrderLines)._groupIntoMap((line) => [line.supplier_order_id, line]);
			// Create supplier orders
			for (const [supplierOrderId, orderLines] of supplierOrderMap.entries()) {
				const lines = [...orderLines];

				// NOTE: supplier id should be the same for every line in the order if this is not the case, the handler will throw
				const [{ supplier_id }] = lines;

				await createSupplierOrder(db, supplierOrderId, supplier_id, lines);
			}

			// Group reconciliation order lines by reconciliation orders
			const reconOrderLineMap = wrapIter(dd.reconciliationOrderLines)._groupIntoMap(({ reconciliation_order_id, ...line }) => [
				reconciliation_order_id,
				line
			]);

			// Add reconciliation orders and lines
			for (const order of dd.reconciliationOrders) {
				await createReconciliationOrder(db, order.id, order.supplier_order_ids);

				// Add lines (if any)
				const lines = reconOrderLineMap.get(order.id);
				if (lines) {
					await upsertReconciliationOrderLines(db, order.id, [...lines]);
				}

				// Finalize order if so specified in the test data
				if (order.finalized) {
					await finalizeReconciliationOrder(db, order.id);
				}
			}

			console.log("Finished populating database.");
		} catch (error) {
			errorMessage = error;
		} finally {
			await loadData();
		}
	};

	const resetDatabase = async function resetDatabase() {
		errorMessage = null;

		if (!confirm($LL.debug_page.dialogs.confirm_reset_database())) {
			return;
		}

		const db = await getDb(app);

		const tables = [
			"book",
			"supplier",
			"supplier_publisher",
			"customer",
			"customer_order_lines",
			"supplier_order",
			"supplier_order_line",
			"reconciliation_order",
			"reconciliation_order_lines"
		];
		console.log("Resetting database");

		await Promise.all(
			tables.map(async (table) => {
				console.log(`Clearing ${table}`);
				await db.exec(`DELETE FROM ${table}`);
			})
		);
		await loadData();
	};

	const loadData = async function () {
		console.log("Loading database");

		isLoading = true;

		const db = await getDb(app);
		try {
			const tables = await db.execO<{ name: string }>(
				"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
			);

			tableExplorerData = tables;
			const preferred = selectedExplorerTable && tables.some((t) => t.name === selectedExplorerTable) ? selectedExplorerTable : null;
			if (preferred) {
				await loadExplorerTablePreview(preferred);
			} else {
				selectedExplorerTable = null;
				selectedExplorerTableRows = [];
				selectedExplorerTableRowCount = 0;
			}
		} catch (error) {
			console.error("Error loading table explorer data:", error);
			errorMessage = error;
		} finally {
			isLoading = false;
		}
	};

	async function executeQuery() {
		isLoading = true;
		errorMessage = null;

		const db = await getDb(app);

		try {
			queryResult = await db.execO(query);
		} catch (error) {
			errorMessage = error;
		} finally {
			isLoading = false;
		}
		await loadData();
	}

	onMount(function () {
		if (browser) {
			try {
				const raw = sessionStorage.getItem(TIMELINE_STORAGE_KEY);
				if (raw) {
					const parsed = JSON.parse(raw) as TimelineEntry[];
					if (Array.isArray(parsed)) {
						diagnosticsTimeline = parsed.slice(0, TIMELINE_LIMIT);
					}
				}
			} catch {
				diagnosticsTimeline = [];
			}
		}

		const tick = setInterval(() => {
			nowTs = Date.now();
		}, 1000);
		void loadData();
		return () => clearInterval(tick);
	});

	const triggerLoadError = () => goto("#/load_error");

	const throwError = () => {
		throw new Error($LL.debug_page.labels.runtime_error());
	};

	const REMOTE_SITE_IDS_KEY = "librocco-remote-site-ids";
	const INJECTED_SYNC_FAILURE_URL = "ws://127.0.0.1:1/sync";
	let savedSyncUrlBeforeInjection: string | null = null;

	/**
	 * Corrupts compatibility identity for debug purposes.
	 * It mutates local site identity and persisted remembered remote identity,
	 * which causes compatibility checks to flag the DB as incompatible.
	 */
	const corruptSyncState = async () => {
		isLoading = true;
		errorMessage = null;

		const db = await getDb(app);

		try {
			// Generate a new random site_id (16 bytes)
			const newSiteId = new Uint8Array(16);
			crypto.getRandomValues(newSiteId);

			// Update the site_id in crsql_site_id table (ordinal 0 is "myself")
			await db.exec("UPDATE crsql_site_id SET site_id = ? WHERE ordinal = 0", [newSiteId]);

			const dbid = get(app.config.dbid);
			const rememberedRaw = localStorage.getItem(REMOTE_SITE_IDS_KEY);
			const remembered = rememberedRaw ? JSON.parse(rememberedRaw) : {};
			remembered[dbid] = Array.from(newSiteId)
				.map((n) => n.toString(16).padStart(2, "0"))
				.join("");
			localStorage.setItem(REMOTE_SITE_IDS_KEY, JSON.stringify(remembered));

			// Do not force the store state directly. Let the normal compatibility check
			// path derive and publish incompatibility.
			await checkSyncCompatibility({
				dbid,
				syncUrl: get(app.config.syncUrl),
				mode: "strict"
			});

			console.log("Sync state corrupted - site_id changed to:", newSiteId);
			toastSuccess({
				title: $LL.debug_page.notifications.local_identity_corrupted_title(),
				description: $LL.debug_page.notifications.local_identity_corrupted_desc()
			});
		} catch (error) {
			console.error("Error corrupting sync state:", error);
			errorMessage = error;
			toastError({
				title: $LL.debug_page.notifications.corrupt_identity_failed_title(),
				description: $LL.debug_page.notifications.corrupt_identity_failed_desc(),
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			isLoading = false;
		}
	};

	const fixCorruptSyncState = async () => {
		isLoading = true;
		errorMessage = null;

		try {
			const dbid = get(app.config.dbid);
			const syncUrl = get(app.config.syncUrl);
			const rememberedRaw = localStorage.getItem(REMOTE_SITE_IDS_KEY);
			const remembered = rememberedRaw ? JSON.parse(rememberedRaw) : {};
			delete remembered[dbid];
			localStorage.setItem(REMOTE_SITE_IDS_KEY, JSON.stringify(remembered));

			resetSyncCompatibility(dbid);
			await checkSyncCompatibility({
				dbid,
				syncUrl,
				mode: "strict"
			});
				toastSuccess({
					title: $LL.debug_page.notifications.compat_identity_reset_title(),
					description: $LL.debug_page.notifications.compat_identity_reset_desc()
				});
		} catch (error) {
			console.error("Error resetting sync state:", error);
			errorMessage = error;
				toastError({
					title: $LL.debug_page.notifications.reset_identity_failed_title(),
					description: $LL.debug_page.notifications.reset_identity_failed_desc(),
					detail: error instanceof Error ? error.message : String(error)
				});
		} finally {
			isLoading = false;
		}
	};

	const toggleSyncTransportFailure = async () => {
		isLoading = true;
		errorMessage = null;
		try {
			const syncActive = get(app.config.syncActive);
			if (!syncActive) {
				toastError({
					title: $LL.debug_page.notifications.sync_disabled_title(),
					description: $LL.debug_page.notifications.sync_disabled_inject_desc()
				});
				return;
			}

			const dbid = get(app.config.dbid);
			const currentSyncUrl = get(app.config.syncUrl);

			if (currentSyncUrl !== INJECTED_SYNC_FAILURE_URL) {
				savedSyncUrlBeforeInjection = currentSyncUrl;
				app.config.syncUrl.set(INJECTED_SYNC_FAILURE_URL);
				await stopSync(app);
				await startSync(app, dbid, INJECTED_SYNC_FAILURE_URL);
				toastSuccess({
					title: $LL.debug_page.notifications.sync_transport_failure_injected_title(),
					description: $LL.debug_page.notifications.sync_transport_failure_injected_desc({ url: INJECTED_SYNC_FAILURE_URL })
				});
			} else {
				const restoreUrl = savedSyncUrlBeforeInjection || "ws://localhost:3000/sync";
				app.config.syncUrl.set(restoreUrl);
				await stopSync(app);
				await startSync(app, dbid, restoreUrl);
				savedSyncUrlBeforeInjection = null;
				toastSuccess({
					title: $LL.debug_page.notifications.sync_transport_restored_title(),
					description: $LL.debug_page.notifications.sync_transport_restored_desc({ url: restoreUrl })
				});
			}
		} catch (error) {
			console.error("Error toggling sync transport failure:", error);
			errorMessage = error;
			toastError({
				title: $LL.debug_page.notifications.sync_transport_toggle_failed_title(),
				description: $LL.debug_page.notifications.sync_transport_toggle_failed_desc(),
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			isLoading = false;
		}
	};

	const handleExportState = async () => {
		isLoading = true;
		errorMessage = null;

		try {
			await exportStateArchive(get(app.config.dbid));
		} catch (error) {
			console.error("Error exporting state:", error);
			errorMessage = error;
		} finally {
			isLoading = false;
		}
	};

	const runDbQuickCheck = async () => {
		isLoading = true;
		errorMessage = null;
		try {
			const db = await getDb(app);
			const ok = await runLocalDbQuickCheck(db);
			if (ok) {
				toastSuccess({
					title: $LL.debug_page.notifications.db_quick_check_passed_title(),
					description: $LL.debug_page.notifications.db_quick_check_passed_desc()
				});
			} else {
				toastError({
					title: $LL.debug_page.notifications.db_quick_check_issues_title(),
					description: $LL.debug_page.notifications.db_quick_check_issues_desc()
				});
			}
		} catch (error) {
			console.error("Error running local DB quick_check:", error);
			errorMessage = error;
			toastError({
				title: $LL.debug_page.notifications.db_quick_check_failed_title(),
				description: $LL.debug_page.notifications.db_quick_check_failed_desc(),
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			isLoading = false;
		}
	};

	const runDbIntegrityCheck = async () => {
		isLoading = true;
		errorMessage = null;
		try {
			const db = await getDb(app);
			const result = await runLocalDbIntegrityCheck(db);
			if (result.ok) {
				toastSuccess({
					title: $LL.debug_page.notifications.db_integrity_check_passed_title(),
					description: result.message
				});
			} else {
				toastError({
					title: $LL.debug_page.notifications.db_integrity_check_failed_title(),
					description: result.message
				});
			}
		} catch (error) {
			console.error("Error running local DB integrity_check:", error);
			errorMessage = error;
			toastError({
				title: $LL.debug_page.notifications.db_integrity_check_failed_title(),
				description: $LL.debug_page.notifications.db_integrity_check_failed_desc(),
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			isLoading = false;
		}
	};

	const recheckSyncCompatibilityNow = async () => {
		isLoading = true;
		errorMessage = null;
		try {
			const dbid = get(app.config.dbid);
			const syncUrl = get(app.config.syncUrl);
			const result = await checkSyncCompatibility({ dbid, syncUrl, mode: "strict" });
			if (result.ok) {
				toastSuccess({
					title: $LL.debug_page.notifications.compat_check_passed_title(),
					description: $LL.debug_page.notifications.compat_check_passed_desc()
				});
			} else {
				toastError({
					title: $LL.debug_page.notifications.compat_check_failed_title(),
					description: $LL.debug_page.notifications.compat_check_failed_desc()
				});
			}
		} catch (error) {
			console.error("Error rechecking sync compatibility:", error);
			errorMessage = error;
			toastError({
				title: $LL.debug_page.notifications.compat_check_failed_title(),
				description: $LL.debug_page.notifications.compat_check_failed_run_desc(),
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			isLoading = false;
		}
	};

	const runConnectionProbe = async () => {
		isLoading = true;
		isRunningConnectionProbe = true;
		errorMessage = null;

		try {
			const dbid = get(app.config.dbid);
			const syncUrl = get(app.config.syncUrl);
			const syncActive = get(app.config.syncActive);
			const metaUrl = buildMetaProbeUrl(syncUrl, dbid);

			const metaStart = performance.now();
			let metaResult: MetaProbeResult;
			try {
				const resp = await fetch(metaUrl, { method: "GET" });
				let bodySnippet = "";
				try {
					const txt = await resp.text();
					bodySnippet = txt.slice(0, 180);
				} catch {
					// ignore body decode errors
				}
				metaResult = {
					ok: resp.ok,
					url: metaUrl,
					latencyMs: Math.round(performance.now() - metaStart),
					status: resp.status,
					bodySnippet: bodySnippet || undefined,
					error: resp.ok ? undefined : `HTTP ${resp.status}`
				};
			} catch (err) {
				metaResult = {
					ok: false,
					url: metaUrl,
					latencyMs: Math.round(performance.now() - metaStart),
					error: err instanceof Error ? err.message : String(err)
				};
			}

			const wsResult: WsProbeResult = await new Promise((resolve) => {
				const wsStart = performance.now();
				let settled = false;

				const finish = (result: WsProbeResult) => {
					if (settled) return;
					settled = true;
					resolve(result);
				};

				let ws: WebSocket | null = null;
				try {
					const protocolToken = btoa(`room=${dbid}`).replaceAll("=", "");
					ws = new WebSocket(syncUrl, [protocolToken]);
				} catch (err) {
					finish({
						ok: false,
						url: syncUrl,
						latencyMs: Math.round(performance.now() - wsStart),
						error: err instanceof Error ? err.message : String(err)
					});
					return;
				}

				const timeout = setTimeout(() => {
					try {
						ws?.close();
					} catch {
						// ignore close errors
					}
					finish({
						ok: false,
						url: syncUrl,
						latencyMs: Math.round(performance.now() - wsStart),
						error: "WebSocket open timed out (5s)"
					});
				}, 5000);

				ws.onopen = () => {
					clearTimeout(timeout);
					const latencyMs = Math.round(performance.now() - wsStart);
					try {
						ws.close(1000, "debug-probe");
					} catch {
						// ignore close errors
					}
					finish({
						ok: true,
						url: syncUrl,
						latencyMs
					});
				};

				ws.onerror = () => {
					clearTimeout(timeout);
					finish({
						ok: false,
						url: syncUrl,
						latencyMs: Math.round(performance.now() - wsStart),
						error: "WebSocket error event"
					});
				};

				ws.onclose = (event) => {
					clearTimeout(timeout);
					if (settled) return;
					finish({
						ok: event.code === 1000,
						url: syncUrl,
						latencyMs: Math.round(performance.now() - wsStart),
						closeCode: event.code,
						closeReason: event.reason || undefined,
						error: event.code === 1000 ? undefined : "Socket closed before successful probe"
					});
				};
			});

			connectionProbe = {
				at: Date.now(),
				syncActive,
				dbid,
				syncUrl,
				meta: metaResult,
				ws: wsResult
			};

			if (metaResult.ok && wsResult.ok) {
					pushTimeline($LL.debug_page.timeline_events.check_connection_probe_passed(), "success");
					toastSuccess({
						title: $LL.debug_page.notifications.connection_probe_passed_title(),
						description: $LL.debug_page.notifications.connection_probe_passed_desc()
					});
				} else {
					pushTimeline($LL.debug_page.timeline_events.check_connection_probe_issues(), "warning");
					toastError({
						title: $LL.debug_page.notifications.connection_probe_issues_title(),
						description: $LL.debug_page.notifications.connection_probe_issues_desc(),
						detail: `meta=${metaResult.ok ? "ok" : "fail"}, ws=${wsResult.ok ? "ok" : "fail"}`
					});
				}
		} catch (error) {
			console.error("Error running connection probe:", error);
			errorMessage = error;
			pushTimeline($LL.debug_page.timeline_events.check_connection_probe_failed(), "error");
			toastError({
				title: $LL.debug_page.notifications.connection_probe_failed_title(),
				description: $LL.debug_page.notifications.connection_probe_failed_desc(),
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			isLoading = false;
			isRunningConnectionProbe = false;
		}
	};

	const copyConnectionProbeResult = async () => {
		if (!connectionProbe) return;
		try {
			await navigator.clipboard.writeText(JSON.stringify(connectionProbe, null, 2));
			toastSuccess({
				title: $LL.debug_page.notifications.probe_copied_title(),
				description: $LL.debug_page.notifications.probe_copied_desc()
			});
		} catch (error) {
			toastError({
				title: $LL.debug_page.notifications.copy_failed_title(),
				description: $LL.debug_page.notifications.copy_failed_probe(),
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	};

	const copySyncConfigSanityResult = async () => {
		if (!syncConfigSanity) return;
		try {
			await navigator.clipboard.writeText(JSON.stringify(syncConfigSanity, null, 2));
			toastSuccess({
				title: $LL.debug_page.notifications.sync_config_copied_title(),
				description: $LL.debug_page.notifications.sync_config_copied_desc()
			});
		} catch (error) {
			toastError({
				title: $LL.debug_page.notifications.copy_failed_title(),
				description: $LL.debug_page.notifications.copy_failed_config(),
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	};

	const copyHandshakeStatusCheckResult = async () => {
		if (!handshakeStatusCheck) return;
		try {
			await navigator.clipboard.writeText(JSON.stringify(handshakeStatusCheck, null, 2));
			toastSuccess({
				title: $LL.debug_page.notifications.handshake_status_copied_title(),
				description: $LL.debug_page.notifications.handshake_status_copied_desc()
			});
		} catch (error) {
			toastError({
				title: $LL.debug_page.notifications.copy_failed_title(),
				description: $LL.debug_page.notifications.copy_failed_handshake(),
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	};

	const copyLastSyncErrors = async () => {
		try {
			await navigator.clipboard.writeText(
				JSON.stringify(
					{
						at: new Date().toISOString(),
						errors: get(syncRuntimeHealth).recentErrors
					},
					null,
					2
				)
			);
			toastSuccess({
				title: $LL.debug_page.notifications.sync_errors_copied_title(),
				description: $LL.debug_page.notifications.sync_errors_copied_desc()
			});
		} catch (error) {
			toastError({
				title: $LL.debug_page.notifications.copy_failed_title(),
				description: $LL.debug_page.notifications.copy_failed_sync_errors(),
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	};

	const clearConnectionProbeResult = () => {
		connectionProbe = null;
	};

	const clearHandshakeStatusCheckResult = () => {
		handshakeStatusCheck = null;
	};

	const clearSyncConfigSanityResult = () => {
		syncConfigSanity = null;
	};

	const clearLastSyncErrors = () => {
		resetSyncRuntimeHealth();
		toastSuccess({
			title: $LL.debug_page.notifications.sync_errors_cleared_title(),
			description: $LL.debug_page.notifications.sync_errors_cleared_desc()
		});
	};

	const runHandshakeStatusCheck = async () => {
		isLoading = true;
		isRunningHandshakeCheck = true;
		errorMessage = null;

		try {
			const connectedNow = get(syncConnected);
			if (!connectedNow) {
				handshakeStatusCheck = {
					at: Date.now(),
						ok: false,
						reason: "transport_closed",
						message: $LL.debug_page.status_messages.transport_disconnected(),
						timedOut: false
					};
					pushTimeline($LL.debug_page.timeline_events.check_handshake_disconnected(), "warning");
					toastError({
						title: $LL.debug_page.notifications.handshake_status_unavailable_title(),
						description: $LL.debug_page.notifications.handshake_status_unavailable_desc()
					});
				return;
			}

			const result = await app.sync.runExclusive(async (sync) => {
				return await new Promise<HandshakeStatusCheckResult>((resolve) => {
					let settled = false;
					let unsubscribe = () => {};

					const finish = (value: HandshakeStatusCheckResult) => {
						if (settled) return;
						settled = true;
						resolve(value);
					};

					const timeout = setTimeout(() => {
						const connected = get(syncConnected);
						const diag = get(syncConnDiagnostics);
						const latestErr = get(syncRuntimeHealth).recentErrors[0];
						finish({
							at: Date.now(),
							ok: false,
								reason: connected ? latestErr?.reason : "transport_closed",
								message: connected
									? $LL.debug_page.status_messages.no_sync_status_timeout()
									: diag.disconnectedSince
										? $LL.debug_page.status_messages.transport_disconnected_age({ age: fmtAge(diag.disconnectedSince, nowTs) })
										: $LL.debug_page.status_messages.transport_disconnected_plain(),
								timedOut: true
							});
					}, 3000);

					const onSyncStatus = (payload: {
						ok: boolean;
						siteId?: string;
						schemaName?: string;
						schemaVersion?: string;
						schemaHash?: string;
						stage?: string;
						ackDbVersion?: number;
						reason?: string;
						message?: string;
					}) => {
						clearTimeout(timeout);
						finish({
							at: Date.now(),
							ok: payload.ok,
							stage: payload.stage,
							reason: payload.reason,
							message: payload.message,
							ackDbVersion: payload.ackDbVersion,
							siteId: payload.siteId,
							schemaVersion: payload.schemaVersion ?? payload.schemaHash,
							timedOut: false
						});
						unsubscribe();
					};

					unsubscribe = sync.worker.onSyncStatus(onSyncStatus);
					if (settled) {
						unsubscribe();
					}
				});
			});

			handshakeStatusCheck = result;
			if (result.ok) {
				pushTimeline($LL.debug_page.timeline_events.check_handshake_passed(), "success");
				toastSuccess({
					title: $LL.debug_page.notifications.handshake_status_received_title(),
					description: $LL.debug_page.notifications.handshake_status_received_desc({
						stage: result.stage || $LL.debug_page.checks.na(),
						ack: String(result.ackDbVersion ?? $LL.debug_page.checks.na())
					})
				});
			} else {
				pushTimeline($LL.debug_page.timeline_events.check_handshake_failed(), result.timedOut ? "warning" : "error");
				toastError({
					title: result.timedOut
						? $LL.debug_page.notifications.handshake_check_timed_out_title()
						: $LL.debug_page.notifications.handshake_reported_issues_title(),
					description: result.message || result.reason || $LL.debug_page.notifications.sync_status_reported_failure()
				});
			}
		} catch (error) {
			console.error("Error running handshake status check:", error);
			errorMessage = error;
			pushTimeline($LL.debug_page.timeline_events.check_handshake_check_failed(), "error");
			toastError({
				title: $LL.debug_page.notifications.handshake_status_check_failed_title(),
				description: $LL.debug_page.notifications.handshake_status_check_failed_desc(),
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			isLoading = false;
			isRunningHandshakeCheck = false;
		}
	};

	const runSyncConfigSanityCheck = async () => {
		isLoading = true;
		isRunningSanityCheck = true;
		errorMessage = null;
		try {
			const dbid = get(app.config.dbid);
			const syncUrl = get(app.config.syncUrl);
			const syncActive = get(app.config.syncActive);
			const problems: string[] = [];
			let wsUrlOk = false;
			let metaUrl: string | null = null;

			if (!dbid?.trim()) {
				problems.push($LL.debug_page.sanity_problems.db_id_empty());
			}
			if (!syncUrl?.trim()) {
				problems.push($LL.debug_page.sanity_problems.sync_url_empty());
			}

			if (syncUrl?.trim()) {
				try {
					const parsed = new URL(syncUrl);
						wsUrlOk = parsed.protocol === "ws:" || parsed.protocol === "wss:";
						if (!wsUrlOk) {
							problems.push($LL.debug_page.sanity_problems.sync_url_protocol_invalid({ protocol: parsed.protocol }));
						}
					} catch {
						problems.push($LL.debug_page.sanity_problems.sync_url_invalid());
					}
				}

			if (syncUrl?.trim() && dbid?.trim()) {
					try {
						metaUrl = buildMetaProbeUrl(syncUrl, dbid);
					} catch {
						problems.push($LL.debug_page.sanity_problems.meta_url_derive_failed());
					}
				}

			syncConfigSanity = {
				at: Date.now(),
				syncActive,
				dbid,
				syncUrl,
				metaUrl,
				wsUrlOk,
				problems
			};

			if (problems.length === 0) {
				pushTimeline($LL.debug_page.timeline_events.check_config_sanity_passed(), "success");
				toastSuccess({
					title: $LL.debug_page.notifications.sync_config_sanity_passed_title(),
					description: $LL.debug_page.notifications.sync_config_sanity_passed_desc()
				});
			} else {
				pushTimeline($LL.debug_page.timeline_events.check_config_sanity_issues({ count: problems.length }), "warning");
				toastError({
					title: $LL.debug_page.notifications.sync_config_sanity_issues_title(),
					description: $LL.debug_page.notifications.sync_config_sanity_issues_desc({ count: problems.length })
				});
			}
		} catch (error) {
			console.error("Error running sync config sanity check:", error);
			errorMessage = error;
			pushTimeline($LL.debug_page.timeline_events.check_config_sanity_failed(), "error");
			toastError({
				title: $LL.debug_page.notifications.sync_config_sanity_failed_title(),
				description: $LL.debug_page.notifications.sync_config_sanity_failed_desc(),
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			isLoading = false;
			isRunningSanityCheck = false;
		}
	};

	const runManualAutoRecovery = async () => {
		isLoading = true;
		errorMessage = null;
		markAutoRecoveryAttempt();
		try {
			const dbid = get(app.config.dbid);
			const syncUrl = get(app.config.syncUrl);
			const db = await getDb(app);
			const syncActive = get(app.config.syncActive);
			if (!syncActive) {
				markAutoRecoveryNoop();
					toastError({
						title: $LL.debug_page.notifications.sync_disabled_title(),
						description: $LL.debug_page.notifications.sync_disabled_manual_recovery_desc()
					});
				return;
			}

			await runLocalDbQuickCheck(db);
			const compatibilityResult = await checkSyncCompatibility({ dbid, syncUrl, mode: "strict" });

			const isDisconnected = !get(syncConnected);
			const disconnectedForMs = (() => {
				const since = get(syncConnDiagnostics).disconnectedSince;
				return since ? Date.now() - since : 0;
			})();
			const disconnectedTooLong = isDisconnected && disconnectedForMs >= 10_000;
			const hasPending = get(pendingChangesCount) > 0;

			if (!compatibilityResult.ok || disconnectedTooLong || (isDisconnected && hasPending)) {
				await stopSync(app);
				await startSync(app, dbid, syncUrl);
				markAutoRecoverySuccess();
					toastSuccess({
						title: $LL.debug_page.notifications.manual_auto_recovery_applied_title(),
						description: $LL.debug_page.notifications.manual_auto_recovery_applied_desc()
					});
				} else {
					markAutoRecoveryNoop();
					toastSuccess({
						title: $LL.debug_page.notifications.manual_auto_recovery_not_needed_title(),
						description: $LL.debug_page.notifications.manual_auto_recovery_not_needed_desc()
					});
				}
		} catch (error) {
			console.error("Error running manual auto-recovery:", error);
			errorMessage = error;
			markAutoRecoveryFailure(error);
				toastError({
					title: $LL.debug_page.notifications.manual_auto_recovery_failed_title(),
					description: $LL.debug_page.notifications.manual_auto_recovery_failed_desc(),
					detail: error instanceof Error ? error.message : String(error)
				});
		} finally {
			isLoading = false;
		}
	};

	const restartSyncWorker = async () => {
		isLoading = true;
		errorMessage = null;
		try {
			const syncActive = get(app.config.syncActive);
			if (!syncActive) {
					toastError({
						title: $LL.debug_page.notifications.sync_disabled_title(),
						description: $LL.debug_page.notifications.sync_disabled_restart_desc()
					});
				return;
			}

			const dbid = get(app.config.dbid);
			const syncUrl = get(app.config.syncUrl);
			await stopSync(app);
			await startSync(app, dbid, syncUrl);
				toastSuccess({
					title: $LL.debug_page.notifications.sync_worker_restarted_title(),
					description: $LL.debug_page.notifications.sync_worker_restarted_desc()
				});
		} catch (error) {
			console.error("Error restarting sync worker:", error);
			errorMessage = error;
				toastError({
					title: $LL.debug_page.notifications.restart_sync_worker_failed_title(),
					description: $LL.debug_page.notifications.restart_sync_worker_failed_desc(),
					detail: error instanceof Error ? error.message : String(error)
				});
		} finally {
			isLoading = false;
		}
	};

	const exportSyncDiagnostics = async () => {
		isLoading = true;
		errorMessage = null;
		try {
			const dbid = get(app.config.dbid);
			const diagnostics = {
				capturedAt: new Date().toISOString(),
				config: {
					dbid,
					syncUrl: get(app.config.syncUrl),
					syncActive: get(app.config.syncActive)
				},
				connectivity: {
					connected: get(syncConnectivityMonitor.connected),
					stuck: get(syncConnectivityMonitor.stuck),
					diagnostics: get(syncConnectivityMonitor.diagnostics)
				},
				compatibility: get(syncCompatibility),
				runtimeHealth: get(syncRuntimeHealth),
				autoRecovery: get(syncAutoRecovery),
				localDbHealth: get(localDbHealth),
				pending: {
					count: get(pendingChangesCount),
					since: get(pendingChangesSince),
					lastActiveAt: get(pendingChangesLastActiveAt)
				}
			};

			const content = JSON.stringify(diagnostics, null, 2);

			try {
				await navigator.clipboard.writeText(content);
			} catch {
				// Ignore clipboard failures in restrictive contexts.
			}

			const blob = new Blob([content], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `sync-diagnostics-${dbid}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);

				toastSuccess({
					title: $LL.debug_page.notifications.diagnostics_exported_title(),
					description: $LL.debug_page.notifications.diagnostics_exported_desc()
				});
		} catch (error) {
			console.error("Error exporting sync diagnostics:", error);
			errorMessage = error;
				toastError({
					title: $LL.debug_page.notifications.export_diagnostics_failed_title(),
					description: $LL.debug_page.notifications.export_diagnostics_failed_desc(),
					detail: error instanceof Error ? error.message : String(error)
				});
		} finally {
			isLoading = false;
		}
	};

	const nukeAndResyncNow = async () => {
		if (!confirm($LL.debug_page.dialogs.confirm_nuke_resync())) {
			return;
		}

		isLoading = true;
		errorMessage = null;
		try {
			await nukeAndResyncDb(app, get(app.config.dbid), getVfs(app));
			toastSuccess({
				title: $LL.debug_page.notifications.resync_started_title(),
				description: $LL.debug_page.notifications.resync_started_desc()
			});
		} catch (error) {
			console.error("Error running nuke and resync:", error);
			errorMessage = error;
			toastError({
				title: $LL.debug_page.notifications.nuke_resync_failed_title(),
				description: $LL.debug_page.notifications.nuke_resync_failed_desc(),
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			isLoading = false;
		}
	};

	let error = false;
</script>

<Page title={$LL.debug_page.title()} view="debug" {app} {plugins}>
	<div slot="main" class="h-full w-full overflow-auto pb-8">
		<div class="w-full space-y-6 px-4 py-4">
			<section class="border-b border-base-300 pb-6">
				<h2 class="text-lg font-semibold">{$LL.debug_page.sections.diagnostics.title()}</h2>
				<p class="mb-3 text-sm opacity-70">{$LL.debug_page.sections.diagnostics.description()}</p>
				<div class="mb-3 space-y-3">
					<div class="grid gap-3 xl:grid-cols-3">
						<div class="rounded-lg border border-base-300 bg-base-200/40 p-3">
							<div class="mb-2 flex items-center justify-between">
								<div class="text-xs font-semibold uppercase tracking-wide opacity-70">{$LL.debug_page.diagnostics.health_rail.title()}</div>
								<div class="text-xs opacity-70">{new Date(nowTs).toLocaleTimeString()}</div>
							</div>
							<p class="mb-3 text-xs opacity-70">{$LL.debug_page.health_rail.description()}</p>
							<div class="space-y-3">
								<div class="text-xs">
									<div class="mb-1 flex items-center justify-between gap-2">
										<span class="font-semibold">{$LL.debug_page.health_rail.connection()}</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${toneClass(connectionTone)}`}>
											{$syncStuck
												? `${$LL.debug_page.health_rail.stuck()} (${formatUiLabel($syncConnDiagnostics.reason || $LL.debug_page.checks.na())})`
												: $syncConnected
													? $LL.debug_page.health_rail.connected_transport_open()
													: connectionViaOtherTab
														? $LL.debug_page.health_rail.connected_other_tab()
														: $LL.debug_page.health_rail.disconnected_transport_closed()}
										</span>
									</div>
									<div class="opacity-70">
										{connectionViaOtherTab
											? $LL.debug_page.health_rail.derived_transport_other_tab()
											: $LL.debug_page.health_rail.derived_transport()}
									</div>
									<div class="opacity-70">
										{$LL.debug_page.health_rail.events_line({ openCount: $syncConnDiagnostics.openCount, closeCount: $syncConnDiagnostics.closeCount })}
										{#if $syncConnDiagnostics.disconnectedSince}
											.{$LL.debug_page.health_rail.disconnected_for({ age: fmtAge($syncConnDiagnostics.disconnectedSince, nowTs) })}
										{/if}
									</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex items-center justify-between gap-2">
										<span class="font-semibold">{$LL.debug_page.health_rail.compatibility()}</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${toneClass(compatibilityTone)}`}>
											{$syncCompatibility.status === "incompatible"
												? `Incompatible (${formatUiLabel($syncCompatibility.reason)})`
												: $syncCompatibility.status === "compatible"
													? $LL.debug_page.health_rail.compatible_schema({
															schemaVersion: String($syncCompatibility.remoteSchemaVersion ?? localSchemaVersionLabel)
														})
													: `${formatUiLabel($syncCompatibility.status)} (schema ${localSchemaVersionLabel})`}
										</span>
									</div>
									<div class="opacity-70">{$LL.debug_page.health_rail.derived_compatibility()}</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex items-center justify-between gap-2">
										<span class="font-semibold">{$LL.debug_page.health_rail.local_db()}</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${toneClass(localDbTone)}`}>
											{$LL.debug_page.health_rail.local_db_status({
												status: formatUiLabel($localDbHealth.status),
												check: $localDbHealth.lastIntegrityCheckAt
													? $LL.debug_page.health_rail.integrity_check()
													: $localDbHealth.lastQuickCheckAt
														? $LL.debug_page.health_rail.quick_check()
														: $LL.debug_page.health_rail.none()
											})}
										</span>
									</div>
									<div class="opacity-70">{$LL.debug_page.health_rail.derived_local_db()}</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex items-center justify-between gap-2">
										<span class="font-semibold">{$LL.debug_page.health_rail.pending_queue()}</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${toneClass(pendingTone)}`}>
											{$LL.debug_page.health_rail.pending_count({ count: $pendingChangesCount })}
										</span>
									</div>
									<div class="opacity-70">{$LL.debug_page.health_rail.derived_pending()}</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex items-center justify-between gap-2">
										<span class="font-semibold">{$LL.debug_page.health_rail.auto_recovery()}</span>
										<span
											class={`inline-flex rounded border px-2 py-0.5 font-semibold ${toneClass(
												$syncAutoRecovery.lastResult === "failure"
													? "error"
													: $syncAutoRecovery.lastResult === "success"
														? "success"
													: "info"
											)}`}
										>
											{$LL.debug_page.health_rail.auto_recovery_status({
												result: formatUiLabel($syncAutoRecovery.lastResult || "idle"),
												age: $syncAutoRecovery.lastAttemptAt
													? fmtAge($syncAutoRecovery.lastAttemptAt, nowTs)
													: $LL.debug_page.health_rail.never()
											})}
										</span>
									</div>
									<div class="opacity-70">{$LL.debug_page.health_rail.derived_auto_recovery()}</div>
								</div>
							</div>
						</div>

						<div class="rounded-lg border border-base-300 bg-base-200/40 p-3">
							<div class="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">{$LL.debug_page.diagnostics.freshness.title()}</div>
							<p class="mb-3 text-xs opacity-70">{$LL.debug_page.diagnostics.freshness.description()}</p>
							<div class="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
								<div class="text-xs">
									<div class="mb-1 flex justify-between">
										<span class="font-semibold">{$LL.debug_page.freshness.status_heartbeat()}</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${levelClass(statusFreshnessLevel)}`}>
											{levelLabel(statusFreshnessLevel)}
										</span>
									</div>
									<div class="mb-1 flex justify-between opacity-70">
										<span>{$syncConnected
											? $LL.debug_page.freshness.status_connected_live()
											: statusAgeSec == null
												? $LL.debug_page.freshness.na()
												: $LL.debug_page.freshness.status_since_last_heartbeat({ seconds: statusAgeSec })}</span>
										<span>{$LL.debug_page.freshness.warn_stale({ warn: statusWarnSec, stale: statusErrorSec })}</span>
									</div>
									<div class="mb-1 opacity-70">{$LL.debug_page.freshness.last_at({ time: fmtTs(statusHeartbeatAt) })}</div>
									<progress class={`progress w-full ${levelProgressClass(statusFreshnessLevel)}`} value={statusHealthPct} max="100"></progress>
									<div class="mt-1 opacity-70">{$LL.debug_page.freshness.status_description()}</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex justify-between">
										<span class="font-semibold">{$LL.debug_page.freshness.server_confirmation()}</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${levelClass(ackFreshnessLevel)}`}>
											{levelLabel(ackFreshnessLevel)}
										</span>
									</div>
									<div class="mb-1 flex justify-between opacity-70">
										<span>{$pendingChangesCount > 0
											? ackAgeSec == null
												? $LL.debug_page.health_rail.never()
												: $LL.debug_page.freshness.seconds_ago({ seconds: ackAgeSec })
											: $LL.debug_page.freshness.no_pending_changes()}</span>
										<span>{$LL.debug_page.freshness.warn_stale({ warn: ackWarnSec, stale: ackErrorSec })}</span>
									</div>
									<div class="mb-1 opacity-70">{$LL.debug_page.freshness.last_at({ time: fmtTs($syncRuntimeHealth.lastAckAt) })}</div>
									<progress class={`progress w-full ${levelProgressClass(ackFreshnessLevel)}`} value={ackHealthPct} max="100"></progress>
									<div class="mt-1 opacity-70">{$LL.debug_page.freshness.ack_description()}</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex justify-between">
										<span class="font-semibold">{$LL.debug_page.freshness.queue_age()}</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${levelClass(queueFreshnessLevel)}`}>
											{levelLabel(queueFreshnessLevel)}
										</span>
									</div>
									<div class="mb-1 flex justify-between opacity-70">
										<span>{$pendingChangesCount > 0
											? pendingAgeSec == null
												? $LL.debug_page.freshness.na()
												: $LL.debug_page.freshness.seconds_ago({ seconds: pendingAgeSec })
											: $LL.debug_page.freshness.queue_empty()}</span>
										<span>{$LL.debug_page.freshness.warn_stale({ warn: queueWarnSec, stale: queueErrorSec })}</span>
									</div>
									<div class="mb-1 opacity-70">
										{$LL.debug_page.freshness.last_queue_activity({
											time: $pendingChangesLastActiveAt ? fmtTs($pendingChangesLastActiveAt) : $LL.debug_page.health_rail.never()
										})}
									</div>
									<progress class={`progress w-full ${levelProgressClass(queueFreshnessLevel)}`} value={queueHealthPct} max="100"></progress>
									<div class="mt-1 opacity-70">{$LL.debug_page.freshness.queue_description()}</div>
								</div>
							</div>
						</div>

						<div class="rounded-lg border border-base-300 bg-base-200/40 p-3">
							<div class="mb-2 flex items-center justify-between">
								<div class="text-xs font-semibold uppercase tracking-wide opacity-70">{$LL.debug_page.diagnostics.timeline.title()}</div>
								<div class="flex items-center gap-2">
									<div class="text-xs opacity-70">
										{$LL.debug_page.diagnostics.timeline.latest_events({ count: Math.min(diagnosticsTimeline.length, TIMELINE_LIMIT) })}
									</div>
									{#if $syncRuntimeHealth.recentErrors.length > 0}
										<button class="btn-neutral btn btn-xs" on:click={copyLastSyncErrors}>
											<Download size={14} />
											{$LL.debug_page.actions.copy()}
										</button>
										<button class="btn-outline btn btn-xs" on:click={clearLastSyncErrors}>{$LL.debug_page.actions.clear()}</button>
									{/if}
								</div>
							</div>
							<div class="max-h-56 overflow-auto">
								{#if diagnosticsTimeline.length === 0 && $syncRuntimeHealth.recentErrors.length === 0}
									<p class="text-xs opacity-70">{$LL.debug_page.diagnostics.timeline.no_changes()}</p>
								{/if}
								{#if diagnosticsTimeline.length > 0}
									<ul class="space-y-1 text-xs">
										{#each diagnosticsTimeline as evt}
											<li class="rounded border border-base-300 bg-base-100 p-2">
												<div class="flex items-center justify-between gap-2">
													<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${toneClass(evt.severity)}`}>{evt.message}</span>
													<span class="shrink-0 opacity-60">{new Date(evt.at).toLocaleTimeString()}</span>
												</div>
											</li>
										{/each}
									</ul>
								{/if}
								{#if $syncRuntimeHealth.recentErrors.length > 0}
									<div class="mt-2 border-t border-base-300 pt-2 text-xs font-semibold opacity-70">{$LL.debug_page.diagnostics.timeline.recent_sync_errors()}</div>
									<ul class="mt-1 space-y-1 text-xs">
										{#each $syncRuntimeHealth.recentErrors as err}
											<li class="rounded border border-base-300 bg-base-100 p-2">
												<div class="flex items-center justify-between gap-2">
													<span class="inline-flex rounded border border-red-300 bg-red-100 px-2 py-0.5 font-semibold text-red-800">
														{formatUiLabel(err.reason)}
													</span>
													<span class="shrink-0 opacity-60">{new Date(err.at).toLocaleTimeString()}</span>
												</div>
												{#if err.message}
													<div class="mt-1 truncate opacity-80">{err.message}</div>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</section>

			<section class="border-b border-base-300 pb-6">
				<h2 class="text-lg font-semibold">{$LL.debug_page.sections.checks.title()}</h2>
				<p class="mb-3 text-sm opacity-70">{$LL.debug_page.sections.checks.description()}</p>
				<div class="grid gap-2 md:grid-cols-2">
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.checks.recheck_sync_compatibility.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.checks.recheck_sync_compatibility.description()}</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={recheckSyncCompatibilityNow} disabled={isLoading}>
								<Play size={16} />
								{$LL.debug_page.actions.run_check()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.checks.run_db_quick_check.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.checks.run_db_quick_check.description()}</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runDbQuickCheck} disabled={isLoading}>
								<Play size={16} />
								{$LL.debug_page.actions.run_check()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.checks.run_db_integrity_check.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.checks.run_db_integrity_check.description()}</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runDbIntegrityCheck} disabled={isLoading}>
								<AlertTriangle size={16} />
								{$LL.debug_page.actions.run_check()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.checks.run_connection_probe.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.checks.run_connection_probe.description()}</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runConnectionProbe} disabled={isLoading || isRunningConnectionProbe}>
								<Play size={16} />
								{isRunningConnectionProbe ? $LL.debug_page.actions.running() : $LL.debug_page.actions.run_check()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.checks.run_handshake_status_check.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.checks.run_handshake_status_check.description()}</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runHandshakeStatusCheck} disabled={isLoading || isRunningHandshakeCheck}>
								<Play size={16} />
								{isRunningHandshakeCheck ? $LL.debug_page.actions.running() : $LL.debug_page.actions.run_check()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.checks.run_sync_config_sanity.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.checks.run_sync_config_sanity.description()}</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runSyncConfigSanityCheck} disabled={isLoading || isRunningSanityCheck}>
								<Play size={16} />
								{isRunningSanityCheck ? $LL.debug_page.actions.running() : $LL.debug_page.actions.run_check()}
							</button>
						</div>
					</div>
				</div>
				{#if connectionProbe}
					<div class="mt-3 rounded border border-base-300 bg-base-200/40 p-3 text-xs">
						<div class="mb-2 flex items-center justify-between gap-2">
							<div class="font-semibold">{$LL.debug_page.checks.last_connection_probe()}</div>
							<div class="flex items-center gap-1">
								<button class="btn-neutral btn btn-xs" on:click={copyConnectionProbeResult}>
									<Download size={14} />
									{$LL.debug_page.actions.copy()}
								</button>
								<button class="btn-outline btn btn-xs" on:click={clearConnectionProbeResult}>{$LL.debug_page.actions.clear()}</button>
							</div>
						</div>
						<div class="grid gap-1">
							<div>{$LL.debug_page.checks.time()}: {new Date(connectionProbe.at).toLocaleTimeString()}</div>
							<div>{$LL.debug_page.checks.sync_active()}: {String(connectionProbe.syncActive)}</div>
							<div class="truncate">{$LL.debug_page.checks.db_id()}: {connectionProbe.dbid}</div>
							<div class="truncate">{$LL.debug_page.checks.sync_url()}: {connectionProbe.syncUrl}</div>
							<div class="truncate">
								{$LL.debug_page.checks.meta()}: {connectionProbe.meta.ok ? $LL.debug_page.checks.ok() : $LL.debug_page.checks.fail()} | status {connectionProbe.meta.status ?? $LL.debug_page.checks.na()} | {connectionProbe.meta.latencyMs} ms
								{connectionProbe.meta.error ? ` | ${connectionProbe.meta.error}` : ""}
							</div>
							<div class="truncate">
								{$LL.debug_page.checks.websocket()}: {connectionProbe.ws.ok ? $LL.debug_page.checks.ok() : $LL.debug_page.checks.fail()} | close {connectionProbe.ws.closeCode ?? $LL.debug_page.checks.na()} | {connectionProbe.ws.latencyMs} ms
								{connectionProbe.ws.error ? ` | ${connectionProbe.ws.error}` : ""}
							</div>
							{#if connectionProbe.meta.bodySnippet}
								<div class="truncate opacity-70">{$LL.debug_page.checks.meta_body_snippet()}: {connectionProbe.meta.bodySnippet}</div>
							{/if}
						</div>
					</div>
				{/if}
				{#if handshakeStatusCheck}
					<div class="mt-3 rounded border border-base-300 bg-base-200/40 p-3 text-xs">
						<div class="mb-2 flex items-center justify-between gap-2">
							<div class="font-semibold">{$LL.debug_page.checks.last_handshake_status_check()}</div>
							<div class="flex items-center gap-1">
								<button class="btn-neutral btn btn-xs" on:click={copyHandshakeStatusCheckResult}>
									<Download size={14} />
									{$LL.debug_page.actions.copy()}
								</button>
								<button class="btn-outline btn btn-xs" on:click={clearHandshakeStatusCheckResult}>{$LL.debug_page.actions.clear()}</button>
							</div>
						</div>
						<div class="grid gap-1">
							<div>{$LL.debug_page.checks.time()}: {new Date(handshakeStatusCheck.at).toLocaleTimeString()}</div>
							<div>{$LL.debug_page.checks.result()}: {handshakeStatusCheck.ok ? $LL.debug_page.checks.ok() : $LL.debug_page.checks.fail()}{handshakeStatusCheck.timedOut ? ` (${$LL.debug_page.checks.timed_out()})` : ""}</div>
							<div>{$LL.debug_page.checks.stage()}: {handshakeStatusCheck.stage || $LL.debug_page.checks.na()}</div>
							<div>{$LL.debug_page.checks.ack_db_version()}: {handshakeStatusCheck.ackDbVersion ?? $LL.debug_page.checks.na()}</div>
							<div>{$LL.debug_page.checks.reason()}: {handshakeStatusCheck.reason || $LL.debug_page.checks.na()}</div>
							<div class="truncate">{$LL.debug_page.checks.message()}: {handshakeStatusCheck.message || $LL.debug_page.checks.na()}</div>
						</div>
					</div>
				{/if}
				{#if syncConfigSanity}
					<div class="mt-3 rounded border border-base-300 bg-base-200/40 p-3 text-xs">
						<div class="mb-2 flex items-center justify-between gap-2">
							<div class="font-semibold">{$LL.debug_page.checks.last_sync_config_sanity_check()}</div>
							<div class="flex items-center gap-1">
								<button class="btn-neutral btn btn-xs" on:click={copySyncConfigSanityResult}>
									<Download size={14} />
									{$LL.debug_page.actions.copy()}
								</button>
								<button class="btn-outline btn btn-xs" on:click={clearSyncConfigSanityResult}>{$LL.debug_page.actions.clear()}</button>
							</div>
						</div>
						<div class="grid gap-1">
							<div>{$LL.debug_page.checks.time()}: {new Date(syncConfigSanity.at).toLocaleTimeString()}</div>
							<div>{$LL.debug_page.checks.sync_active()}: {String(syncConfigSanity.syncActive)}</div>
							<div class="truncate">{$LL.debug_page.checks.db_id()}: {syncConfigSanity.dbid || $LL.debug_page.checks.na()}</div>
							<div class="truncate">{$LL.debug_page.checks.sync_url()}: {syncConfigSanity.syncUrl || $LL.debug_page.checks.na()}</div>
							<div class="truncate">{$LL.debug_page.checks.derived_meta_url()}: {syncConfigSanity.metaUrl || $LL.debug_page.checks.na()}</div>
							<div>{$LL.debug_page.checks.ws_protocol_valid()}: {String(syncConfigSanity.wsUrlOk)}</div>
							<div>{$LL.debug_page.checks.issues()}: {syncConfigSanity.problems.length}</div>
							{#if syncConfigSanity.problems.length > 0}
								<ul class="list-inside list-disc opacity-80">
									{#each syncConfigSanity.problems as problem}
										<li>{problem}</li>
									{/each}
								</ul>
							{/if}
						</div>
					</div>
				{/if}
			</section>

			<section class="border-b border-base-300 pb-6">
				<h2 class="text-lg font-semibold">{$LL.debug_page.sections.recovery.title()}</h2>
				<p class="mb-3 text-sm opacity-70">{$LL.debug_page.sections.recovery.description()}</p>
				<div class="grid gap-2 md:grid-cols-2">
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.recovery_actions.restart_sync_worker.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.recovery_actions.restart_sync_worker.description()}</p>
							</div>
							<button class="btn-success btn btn-sm shrink-0 self-start w-36 justify-center" on:click={restartSyncWorker} disabled={isLoading}>
								<RotateCcw size={16} />
								{$LL.debug_page.actions.run_action()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.recovery_actions.reset_compatibility_identity.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.recovery_actions.reset_compatibility_identity.description()}</p>
							</div>
							<button class="btn-success btn btn-sm shrink-0 self-start w-36 justify-center" on:click={fixCorruptSyncState} disabled={isLoading}>
								<RotateCcw size={16} />
								{$LL.debug_page.actions.run_action()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.recovery_actions.run_manual_auto_recovery.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.recovery_actions.run_manual_auto_recovery.description()}</p>
							</div>
							<button class="btn-success btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runManualAutoRecovery} disabled={isLoading}>
								<RotateCcw size={16} />
								{$LL.debug_page.actions.run_action()}
							</button>
						</div>
					</div>
					<div class="rounded border border-red-400/60 bg-red-50/20 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.recovery_actions.nuke_and_resync_now.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.recovery_actions.nuke_and_resync_now.description()}</p>
							</div>
							<button
								class="btn btn-sm shrink-0 self-start w-36 justify-center border-red-800 bg-red-700 text-white hover:bg-red-800"
								on:click={nukeAndResyncNow}
								disabled={isLoading}
							>
								<AlertTriangle size={16} />
								{$LL.debug_page.actions.run_action()}
							</button>
						</div>
					</div>
				</div>
			</section>

			<section class="border-b border-base-300 pb-6">
				<h2 class="text-lg font-semibold">{$LL.debug_page.sections.inject_problems.title()}</h2>
				<p class="mb-3 text-sm opacity-70">{$LL.debug_page.sections.inject_problems.description()}</p>
				<div class="grid gap-2 md:grid-cols-2">
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.inject_actions.inject_sync_transport_failure.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.inject_actions.inject_sync_transport_failure.description()}</p>
							</div>
							<button class="btn-warning btn btn-sm shrink-0 self-start w-36 justify-center" on:click={toggleSyncTransportFailure} disabled={isLoading}>
								<Unplug size={16} />
								{$syncUrlConfig === INJECTED_SYNC_FAILURE_URL ? $LL.debug_page.actions.restore() : $LL.debug_page.actions.run_action()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.inject_actions.corrupt_local_site_identity.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.inject_actions.corrupt_local_site_identity.description()}</p>
							</div>
							<button class="btn-warning btn btn-sm shrink-0 self-start w-36 justify-center" on:click={corruptSyncState} disabled={isLoading}>
								<Unplug size={16} />
								{$LL.debug_page.actions.run_action()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.inject_actions.trigger_load_error.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.inject_actions.trigger_load_error.description()}</p>
							</div>
							<button class="btn-warning btn btn-sm shrink-0 self-start w-36 justify-center" on:click={triggerLoadError} disabled={isLoading}>
								<AlertTriangle size={16} />
								{$LL.debug_page.actions.run_action()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.inject_actions.trigger_runtime_error.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.inject_actions.trigger_runtime_error.description()}</p>
							</div>
							<button class="btn-warning btn btn-sm shrink-0 self-start w-36 justify-center" on:click={throwError} disabled={isLoading}>
								<AlertTriangle size={16} />
								{$LL.debug_page.actions.run_action()}
							</button>
						</div>
					</div>
				</div>
			</section>

			<section class="border-b border-base-300 pb-6">
				<h2 class="text-lg font-semibold">{$LL.debug_page.sections.data_tools.title()}</h2>
				<p class="mb-3 text-sm opacity-70">{$LL.debug_page.sections.data_tools.description()}</p>
				<div class="grid gap-2 md:grid-cols-2">
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.data_tools.export_state.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.data_tools.export_state.description()}</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={handleExportState} disabled={isLoading}>
								<Download size={16} />
								{$LL.debug_page.actions.export()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.data_tools.export_sync_diagnostics.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.data_tools.export_sync_diagnostics.description()}</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={exportSyncDiagnostics} disabled={isLoading}>
								<Download size={16} />
								{$LL.debug_page.actions.export()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.data_tools.populate_database.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.data_tools.populate_database.description()}</p>
							</div>
							<button class="btn-success btn btn-sm shrink-0 self-start w-36 justify-center" on:click={() => populateDatabase()} disabled={isLoading}>
								<Plus size={16} />
								{$LL.debug_page.actions.run_action()}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.data_tools.upsert_100_books.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.data_tools.upsert_100_books.description()}</p>
							</div>
							<button class="btn-success btn btn-sm shrink-0 self-start w-36 justify-center" on:click={() => upsert100Books()} disabled={isLoading}>
								<BookPlus size={16} />
								{$LL.debug_page.actions.run_action()}
							</button>
						</div>
					</div>
					<div class="rounded border border-red-400/60 bg-red-50/20 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">{$LL.debug_page.data_tools.reset_database.title()}</div>
								<p class="text-xs opacity-70">{$LL.debug_page.data_tools.reset_database.description()}</p>
							</div>
							<button
								class="btn btn-sm shrink-0 self-start w-36 justify-center border-red-800 bg-red-700 text-white hover:bg-red-800"
								on:click={() => resetDatabase()}
								disabled={isLoading}
							>
								<RotateCcw size={16} />
								{$LL.debug_page.actions.run_action()}
							</button>
						</div>
					</div>
				</div>
				<div class="mt-4 space-y-4 border-t border-base-300 pt-4">
					<div>
						<h3 class="mb-2 text-base font-semibold">{$LL.debug_page.data_tools.table_explorer.title()}</h3>
						<div class="space-y-3">
							{#if isLoading}
								<div class="spinner"></div>
							{:else if tableExplorerData.length === 0}
								<p class="text-sm opacity-70">{$LL.debug_page.data_tools.table_explorer.no_tables()}</p>
							{:else}
								<select class="select select-bordered w-full" value={selectedExplorerTable || ""} on:change={handleExplorerTableChange} disabled={isTableLoading}>
									<option value="">{$LL.debug_page.data_tools.table_explorer.select_table()}</option>
									{#each tableExplorerData as table}
										<option value={table.name}>{table.name}</option>
									{/each}
								</select>
							{/if}
							<div class="max-h-[50vh] overflow-auto">
								{#if isTableLoading}
									<div class="spinner"></div>
								{:else if selectedExplorerTable}
									<div class="mb-2 text-xs opacity-70">
										{$LL.debug_page.data_tools.table_explorer.total_rows({ count: selectedExplorerTableRowCount, limit: TABLE_PREVIEW_LIMIT })}
									</div>
									{#if selectedExplorerTableRows.length === 0}
										<p class="text-sm opacity-70">{$LL.debug_page.data_tools.table_explorer.no_rows()}</p>
									{:else}
										<table class="table table-pin-rows">
											<thead>
												<tr>
													{#each Object.keys(selectedExplorerTableRows[0]) as column}
														<th scope="col">{column}</th>
													{/each}
												</tr>
											</thead>
											<tbody>
												{#each selectedExplorerTableRows as row}
													<tr class="hover focus-within:bg-base-200">
														{#each Object.values(row) as value}
															<td>{value}</td>
														{/each}
													</tr>
												{/each}
											</tbody>
										</table>
									{/if}
								{/if}
							</div>
						</div>
					</div>

					<div>
						<h3 class="mb-2 text-base font-semibold">{$LL.debug_page.query_interface.title()}</h3>
						<div class="mb-2 flex flex-col gap-2">
							<textarea bind:value={query} id="query"></textarea>
							<button class="btn-warning btn w-fit" on:click={executeQuery} disabled={isLoading}>
								<Play size={20} />
								{isLoading ? $LL.debug_page.actions.executing() : $LL.debug_page.actions.run_query()}
							</button>
						</div>
						<div class="max-h-[50vh] overflow-auto">
							{#if queryResult || errorMessage}
								<h2 class="mb-3 text-sm font-semibold">{$LL.debug_page.query_interface.results_title()}</h2>

								{#if errorMessage}
									<div class="rounded-lg bg-red-500 p-3 text-white shadow">
										{errorMessage}
									</div>
								{:else if queryResult.length === 0}
									<p>{$LL.debug_page.query_interface.no_results()}</p>
								{:else}
									<table class="table table-pin-rows">
										<thead>
											<tr>
												{#each Object.keys(queryResult[0]) as column}
													<th scope="col">{column}</th>
												{/each}
											</tr>
										</thead>
										<tbody>
											{#each queryResult as row}
												<tr class="hover focus-within:bg-base-200">
													{#each Object.values(row) as value}
														<td>{value}</td>
													{/each}
												</tr>
											{/each}
										</tbody>
									</table>
								{/if}
							{/if}
						</div>
					</div>
				</div>
			</section>
		</div>
	</div>
</Page>

{#if error}
	{@html (() => {
		throw new Error($LL.debug_page.labels.render_time_error());
	})()}
{/if}

<style>
	.spinner {
		width: 10px;
		height: 10px;
		border: 5px solid rgba(0, 0, 0, 0.1);
		border-top-color: #333;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	textarea {
		width: 100%;
		height: 100px;
		font-size: 1rem;
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		border: solid 1px;
	}
</style>

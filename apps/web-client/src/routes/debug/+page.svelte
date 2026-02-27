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
		if (!ts) return "never";
		const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
		if (diffSec < 60) return `${diffSec}s ago`;
		const min = Math.floor(diffSec / 60);
		const sec = diffSec % 60;
		return `${min}m ${sec}s ago`;
	};

	const fmtTs = (ts: number | null) => {
		if (!ts) return "never";
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
		if (!value) return "None";
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
		if (level === "ok") return "Healthy";
		if (level === "warn") return "Warning";
		if (level === "error") return "Stale";
		return "N/A";
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
					? `Connection marked stuck (${String($syncConnDiagnostics.reason || "unknown")})`
					: $syncConnected
						? "Connection restored"
						: "Connection lost",
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
					? `Compatibility issue: ${$syncCompatibility.reason}`
					: `Compatibility state: ${$syncCompatibility.status}`,
				$syncCompatibility.status === "incompatible" ? "error" : "info"
			);
		}
		lastCompatibilitySig = sig;
	}

	$: {
		const sig = `${$localDbHealth.status}|${$localDbHealth.message || ""}`;
		if (lastLocalDbSig && sig !== lastLocalDbSig) {
			pushTimeline(
				$localDbHealth.status === "ok" ? "Local DB health check passed" : `Local DB health: ${$localDbHealth.status}`,
				$localDbHealth.status === "error" ? "error" : $localDbHealth.status === "ok" ? "success" : "warning"
			);
		}
		lastLocalDbSig = sig;
	}

	$: {
		const sig = String($pendingChangesCount);
		if (lastPendingSig && sig !== lastPendingSig) {
			pushTimeline(
				$pendingChangesCount > 0 ? `Pending changes: ${$pendingChangesCount}` : "Pending queue drained",
				$pendingChangesCount > 0 ? "warning" : "success"
			);
		}
		lastPendingSig = sig;
	}

	$: {
		const sig = `${$syncAutoRecovery.lastAttemptAt || ""}|${$syncAutoRecovery.lastResult || ""}|${$syncAutoRecovery.lastError || ""}`;
		if (lastAutoRecoverySig && sig !== lastAutoRecoverySig && $syncAutoRecovery.lastAttemptAt) {
			pushTimeline(
				`Auto recovery: ${$syncAutoRecovery.lastResult || "unknown"}${$syncAutoRecovery.lastError ? ` (${String($syncAutoRecovery.lastError)})` : ""}`,
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

		if (!confirm("This deletes all rows from core local tables used by the app. Continue?")) {
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
		throw new Error("Kaboom! Runtime error");
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
				title: "Local site identity corrupted",
				description: "Updated crsql_site_id and remembered identity. Compatibility should turn incompatible."
			});
		} catch (error) {
			console.error("Error corrupting sync state:", error);
			errorMessage = error;
			toastError({
				title: "Corrupt identity failed",
				description: "Could not mutate local site identity.",
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
				title: "Compatibility identity reset",
				description: "Cleared remembered remote site identity and re-ran strict compatibility check."
			});
		} catch (error) {
			console.error("Error resetting sync state:", error);
			errorMessage = error;
			toastError({
				title: "Reset identity failed",
				description: "Could not reset remembered compatibility identity.",
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
					title: "Sync disabled",
					description: "Enable sync first to inject transport failures."
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
					title: "Sync transport failure injected",
					description: `Sync URL set to ${INJECTED_SYNC_FAILURE_URL}`
				});
			} else {
				const restoreUrl = savedSyncUrlBeforeInjection || "ws://localhost:3000/sync";
				app.config.syncUrl.set(restoreUrl);
				await stopSync(app);
				await startSync(app, dbid, restoreUrl);
				savedSyncUrlBeforeInjection = null;
				toastSuccess({
					title: "Sync transport restored",
					description: `Sync URL restored to ${restoreUrl}`
				});
			}
		} catch (error) {
			console.error("Error toggling sync transport failure:", error);
			errorMessage = error;
			toastError({
				title: "Sync transport toggle failed",
				description: "Could not inject/restore transport failure.",
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
					title: "DB quick_check passed",
					description: "Local DB quick_check returned ok."
				});
			} else {
				toastError({
					title: "DB quick_check found issues",
					description: "Run integrity_check for full diagnostics."
				});
			}
		} catch (error) {
			console.error("Error running local DB quick_check:", error);
			errorMessage = error;
			toastError({
				title: "DB quick_check failed",
				description: "Could not run local DB quick_check.",
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
					title: "DB integrity_check passed",
					description: result.message
				});
			} else {
				toastError({
					title: "DB integrity_check failed",
					description: result.message
				});
			}
		} catch (error) {
			console.error("Error running local DB integrity_check:", error);
			errorMessage = error;
			toastError({
				title: "DB integrity_check failed",
				description: "Could not run local DB integrity_check.",
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
					title: "Compatibility check passed",
					description: "Local and remote sync compatibility is valid."
				});
			} else {
				toastError({
					title: "Compatibility check failed",
					description: "Local and remote sync compatibility did not pass."
				});
			}
		} catch (error) {
			console.error("Error rechecking sync compatibility:", error);
			errorMessage = error;
			toastError({
				title: "Compatibility check failed",
				description: "Could not run strict compatibility check.",
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
				pushTimeline("Check: connection probe passed", "success");
				toastSuccess({
					title: "Connection probe passed",
					description: "Meta endpoint and WebSocket transport are reachable."
				});
			} else {
				pushTimeline("Check: connection probe found issues", "warning");
				toastError({
					title: "Connection probe found issues",
					description: "Check probe details in the Checks section.",
					detail: `meta=${metaResult.ok ? "ok" : "fail"}, ws=${wsResult.ok ? "ok" : "fail"}`
				});
			}
		} catch (error) {
			console.error("Error running connection probe:", error);
			errorMessage = error;
			pushTimeline("Check: connection probe failed", "error");
			toastError({
				title: "Connection probe failed",
				description: "Could not complete connection probe.",
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
				title: "Probe result copied",
				description: "Connection probe JSON copied to clipboard."
			});
		} catch (error) {
			toastError({
				title: "Copy failed",
				description: "Could not copy probe result to clipboard.",
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	};

	const copySyncConfigSanityResult = async () => {
		if (!syncConfigSanity) return;
		try {
			await navigator.clipboard.writeText(JSON.stringify(syncConfigSanity, null, 2));
			toastSuccess({
				title: "Sync config copied",
				description: "Sync config sanity result copied to clipboard."
			});
		} catch (error) {
			toastError({
				title: "Copy failed",
				description: "Could not copy sync config sanity result.",
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	};

	const copyHandshakeStatusCheckResult = async () => {
		if (!handshakeStatusCheck) return;
		try {
			await navigator.clipboard.writeText(JSON.stringify(handshakeStatusCheck, null, 2));
			toastSuccess({
				title: "Handshake status copied",
				description: "Handshake status check result copied to clipboard."
			});
		} catch (error) {
			toastError({
				title: "Copy failed",
				description: "Could not copy handshake status check result.",
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
				title: "Sync errors copied",
				description: "Recent sync errors copied to clipboard."
			});
		} catch (error) {
			toastError({
				title: "Copy failed",
				description: "Could not copy sync errors.",
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
			title: "Sync errors cleared",
			description: "Recent sync runtime errors were cleared."
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
					message: "Transport is currently disconnected.",
					timedOut: false
				};
				pushTimeline("Check: handshake failed (transport disconnected)", "warning");
				toastError({
					title: "Handshake status unavailable",
					description: "Transport is disconnected. Reconnect or run a recovery action first."
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
								? "No sync.status event received within timeout."
								: `Transport is disconnected${diag.disconnectedSince ? ` (${fmtAge(diag.disconnectedSince, nowTs)})` : ""}.`,
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
				pushTimeline("Check: handshake status passed", "success");
				toastSuccess({
					title: "Handshake status received",
					description: `Stage: ${result.stage || "n/a"}, acknowledgment: ${result.ackDbVersion ?? "n/a"}`
				});
			} else {
				pushTimeline("Check: handshake status failed", result.timedOut ? "warning" : "error");
				toastError({
					title: result.timedOut ? "Handshake check timed out" : "Handshake reported issues",
					description: result.message || result.reason || "sync.status reported failure"
				});
			}
		} catch (error) {
			console.error("Error running handshake status check:", error);
			errorMessage = error;
			pushTimeline("Check: handshake status check failed", "error");
			toastError({
				title: "Handshake status check failed",
				description: "Could not read worker sync.status payload.",
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
				problems.push("DB ID is empty.");
			}
			if (!syncUrl?.trim()) {
				problems.push("Sync URL is empty.");
			}

			if (syncUrl?.trim()) {
				try {
					const parsed = new URL(syncUrl);
					wsUrlOk = parsed.protocol === "ws:" || parsed.protocol === "wss:";
					if (!wsUrlOk) {
						problems.push(`Sync URL protocol must be ws/wss (got ${parsed.protocol}).`);
					}
				} catch {
					problems.push("Sync URL is not a valid URL.");
				}
			}

			if (syncUrl?.trim() && dbid?.trim()) {
				try {
					metaUrl = buildMetaProbeUrl(syncUrl, dbid);
				} catch {
					problems.push("Could not derive meta URL from sync URL + DB ID.");
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
				pushTimeline("Check: sync config sanity passed", "success");
				toastSuccess({
					title: "Sync config sanity passed",
					description: "Sync URL, DB ID, and derived meta URL look valid."
				});
			} else {
				pushTimeline(`Check: sync config sanity found ${problems.length} issue(s)`, "warning");
				toastError({
					title: "Sync config sanity found issues",
					description: `${problems.length} issue(s) found. See details in Checks section.`
				});
			}
		} catch (error) {
			console.error("Error running sync config sanity check:", error);
			errorMessage = error;
			pushTimeline("Check: sync config sanity failed", "error");
			toastError({
				title: "Sync config sanity failed",
				description: "Could not run config sanity checks.",
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
					title: "Sync disabled",
					description: "Enable sync first to run manual auto-recovery."
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
					title: "Manual auto-recovery applied",
					description: "Performed checks and restarted sync worker."
				});
			} else {
				markAutoRecoveryNoop();
				toastSuccess({
					title: "Manual auto-recovery not needed",
					description: "Checks passed; no restart was required."
				});
			}
		} catch (error) {
			console.error("Error running manual auto-recovery:", error);
			errorMessage = error;
			markAutoRecoveryFailure(error);
			toastError({
				title: "Manual auto-recovery failed",
				description: "Could not complete recovery sequence.",
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
					title: "Sync disabled",
					description: "Enable sync first to restart the sync worker."
				});
				return;
			}

			const dbid = get(app.config.dbid);
			const syncUrl = get(app.config.syncUrl);
			await stopSync(app);
			await startSync(app, dbid, syncUrl);
			toastSuccess({
				title: "Sync worker restarted",
				description: "Sync worker stop/start sequence completed."
			});
		} catch (error) {
			console.error("Error restarting sync worker:", error);
			errorMessage = error;
			toastError({
				title: "Restart sync worker failed",
				description: "Could not restart sync worker.",
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
				title: "Diagnostics exported",
				description: "Sync diagnostics JSON downloaded and copied to clipboard when permitted."
			});
		} catch (error) {
			console.error("Error exporting sync diagnostics:", error);
			errorMessage = error;
			toastError({
				title: "Export diagnostics failed",
				description: "Could not export sync diagnostics.",
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			isLoading = false;
		}
	};

	const nukeAndResyncNow = async () => {
		if (!confirm("This will delete the local DB and re-sync from remote. Continue?")) {
			return;
		}

		isLoading = true;
		errorMessage = null;
		try {
			await nukeAndResyncDb(app, get(app.config.dbid), getVfs(app));
			toastSuccess({
				title: "Resync started",
				description: "Local DB was reset and remote resync has started."
			});
		} catch (error) {
			console.error("Error running nuke and resync:", error);
			errorMessage = error;
			toastError({
				title: "Nuke and resync failed",
				description: "Could not reset local DB and start resync.",
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			isLoading = false;
		}
	};

	let error = false;
</script>

<Page title="Debug" view="debug" {app} {plugins}>
	<div slot="main" class="h-full w-full overflow-auto pb-8">
		<div class="w-full space-y-6 px-4 py-4">
			<section class="border-b border-base-300 pb-6">
				<h2 class="text-lg font-semibold">Diagnostics</h2>
				<p class="mb-3 text-sm opacity-70">Visual runtime snapshot for connection, compatibility, queue, and local DB health.</p>
				<div class="mb-3 space-y-3">
					<div class="grid gap-3 xl:grid-cols-3">
						<div class="rounded-lg border border-base-300 bg-base-200/40 p-3">
							<div class="mb-2 flex items-center justify-between">
								<div class="text-xs font-semibold uppercase tracking-wide opacity-70">Health Rail</div>
								<div class="text-xs opacity-70">{new Date(nowTs).toLocaleTimeString()}</div>
							</div>
							<p class="mb-3 text-xs opacity-70">
								Core sync health metrics. These values summarize transport, compatibility, local DB condition, pending write pressure, and automatic recovery behavior.
							</p>
							<div class="space-y-3">
								<div class="text-xs">
									<div class="mb-1 flex items-center justify-between gap-2">
										<span class="font-semibold">Connection</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${toneClass(connectionTone)}`}>
											{$syncStuck
												? `Stuck (${formatUiLabel($syncConnDiagnostics.reason || "unknown")})`
												: $syncConnected
													? "Connected (transport open)"
													: connectionViaOtherTab
														? "Connected (other tab)"
														: "Disconnected (transport closed)"}
										</span>
									</div>
									<div class="opacity-70">
										Derived from sync transport events and stuck detection{connectionViaOtherTab ? "; heartbeat currently comes from another tab" : "."}
									</div>
									<div class="opacity-70">
										Events: {$syncConnDiagnostics.openCount} Open / {$syncConnDiagnostics.closeCount} Close
										{#if $syncConnDiagnostics.disconnectedSince}
											. Disconnected for {fmtAge($syncConnDiagnostics.disconnectedSince, nowTs)}
										{/if}
									</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex items-center justify-between gap-2">
										<span class="font-semibold">Compatibility</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${toneClass(compatibilityTone)}`}>
											{$syncCompatibility.status === "incompatible"
												? `Incompatible (${formatUiLabel($syncCompatibility.reason)})`
												: $syncCompatibility.status === "compatible"
													? `Compatible (schema ${$syncCompatibility.remoteSchemaVersion ?? localSchemaVersionLabel})`
													: `${formatUiLabel($syncCompatibility.status)} (schema ${localSchemaVersionLabel})`}
										</span>
									</div>
									<div class="opacity-70">Derived from local/remote identity and schema checks.</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex items-center justify-between gap-2">
										<span class="font-semibold">Local DB</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${toneClass(localDbTone)}`}>
											{formatUiLabel($localDbHealth.status)} ({$localDbHealth.lastIntegrityCheckAt ? "Integrity Check" : $localDbHealth.lastQuickCheckAt ? "Quick Check" : "None"})
										</span>
									</div>
									<div class="opacity-70">Derived from local database health checks.</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex items-center justify-between gap-2">
										<span class="font-semibold">Pending queue</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${toneClass(pendingTone)}`}>
											{$pendingChangesCount} pending
										</span>
									</div>
									<div class="opacity-70">Derived from unsent local changes.</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex items-center justify-between gap-2">
										<span class="font-semibold">Auto recovery</span>
										<span
											class={`inline-flex rounded border px-2 py-0.5 font-semibold ${toneClass(
												$syncAutoRecovery.lastResult === "failure"
													? "error"
													: $syncAutoRecovery.lastResult === "success"
														? "success"
														: "info"
											)}`}
										>
											{formatUiLabel($syncAutoRecovery.lastResult || "idle")} ({$syncAutoRecovery.lastAttemptAt ? fmtAge($syncAutoRecovery.lastAttemptAt, nowTs) : "Never"})
										</span>
									</div>
									<div class="opacity-70">Derived from automatic stale-state recovery attempts.</div>
								</div>
							</div>
						</div>

						<div class="rounded-lg border border-base-300 bg-base-200/40 p-3">
							<div class="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">Freshness</div>
							<p class="mb-3 text-xs opacity-70">
								Freshness indicates how recent sync signals are. Each metric shows explicit thresholds and a state: Healthy, Warning, Stale, or N/A.
							</p>
							<div class="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
								<div class="text-xs">
									<div class="mb-1 flex justify-between">
										<span class="font-semibold">Status heartbeat</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${levelClass(statusFreshnessLevel)}`}>
											{levelLabel(statusFreshnessLevel)}
										</span>
									</div>
									<div class="mb-1 flex justify-between opacity-70">
										<span>{$syncConnected ? "Connected (live)" : statusAgeSec == null ? "never" : `${statusAgeSec}s since last heartbeat`}</span>
										<span>Warn {statusWarnSec}s, stale {statusErrorSec}s</span>
									</div>
									<div class="mb-1 opacity-70">Last at: {fmtTs(statusHeartbeatAt)}</div>
									<progress class={`progress w-full ${levelProgressClass(statusFreshnessLevel)}`} value={statusHealthPct} max="100"></progress>
									<div class="mt-1 opacity-70">Transport keepalive liveness (WebSocket ping/pong), independent from pending writes.</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex justify-between">
										<span class="font-semibold">Server confirmation</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${levelClass(ackFreshnessLevel)}`}>
											{levelLabel(ackFreshnessLevel)}
										</span>
									</div>
									<div class="mb-1 flex justify-between opacity-70">
										<span>{$pendingChangesCount > 0 ? (ackAgeSec == null ? "never" : `${ackAgeSec}s ago`) : "No pending changes"}</span>
										<span>Warn {ackWarnSec}s, stale {ackErrorSec}s</span>
									</div>
									<div class="mb-1 opacity-70">Last at: {fmtTs($syncRuntimeHealth.lastAckAt)}</div>
									<progress class={`progress w-full ${levelProgressClass(ackFreshnessLevel)}`} value={ackHealthPct} max="100"></progress>
									<div class="mt-1 opacity-70">Age of last server acknowledgment while queue has pending writes.</div>
								</div>
								<div class="text-xs">
									<div class="mb-1 flex justify-between">
										<span class="font-semibold">Queue age</span>
										<span class={`inline-flex rounded border px-2 py-0.5 font-semibold ${levelClass(queueFreshnessLevel)}`}>
											{levelLabel(queueFreshnessLevel)}
										</span>
									</div>
									<div class="mb-1 flex justify-between opacity-70">
										<span>{$pendingChangesCount > 0 ? (pendingAgeSec == null ? "n/a" : `${pendingAgeSec}s ago`) : "Queue empty"}</span>
										<span>Warn {queueWarnSec}s, stale {queueErrorSec}s</span>
									</div>
									<div class="mb-1 opacity-70">
										Last queue activity: {$pendingChangesLastActiveAt ? fmtTs($pendingChangesLastActiveAt) : "never"}
									</div>
									<progress class={`progress w-full ${levelProgressClass(queueFreshnessLevel)}`} value={queueHealthPct} max="100"></progress>
									<div class="mt-1 opacity-70">Age of oldest unsent local change.</div>
								</div>
							</div>
						</div>

						<div class="rounded-lg border border-base-300 bg-base-200/40 p-3">
							<div class="mb-2 flex items-center justify-between">
								<div class="text-xs font-semibold uppercase tracking-wide opacity-70">Timeline</div>
								<div class="flex items-center gap-2">
									<div class="text-xs opacity-70">latest {Math.min(diagnosticsTimeline.length, TIMELINE_LIMIT)} events</div>
									{#if $syncRuntimeHealth.recentErrors.length > 0}
										<button class="btn-neutral btn btn-xs" on:click={copyLastSyncErrors}>
											<Download size={14} />
											Copy
										</button>
										<button class="btn-outline btn btn-xs" on:click={clearLastSyncErrors}>Clear</button>
									{/if}
								</div>
							</div>
							<div class="max-h-56 overflow-auto">
								{#if diagnosticsTimeline.length === 0 && $syncRuntimeHealth.recentErrors.length === 0}
									<p class="text-xs opacity-70">No changes recorded in this session yet.</p>
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
									<div class="mt-2 border-t border-base-300 pt-2 text-xs font-semibold opacity-70">Recent sync errors</div>
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
				<h2 class="text-lg font-semibold">Checks</h2>
				<p class="mb-3 text-sm opacity-70">Run explicit diagnostics and export current sync troubleshooting data.</p>
				<div class="grid gap-2 md:grid-cols-2">
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Recheck sync compatibility</div>
								<p class="text-xs opacity-70">Runs the strict local-vs-remote identity check and refreshes compatibility state.</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={recheckSyncCompatibilityNow} disabled={isLoading}>
								<Play size={16} />
								Run check
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Run DB quick check</div>
								<p class="text-xs opacity-70">Fast structural check of local SQLite integrity for routine diagnostics.</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runDbQuickCheck} disabled={isLoading}>
								<Play size={16} />
								Run check
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Run DB integrity check</div>
								<p class="text-xs opacity-70">Deeper integrity scan. Slower; use when you suspect corruption.</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runDbIntegrityCheck} disabled={isLoading}>
								<AlertTriangle size={16} />
								Run check
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Run connection probe</div>
								<p class="text-xs opacity-70">Checks sync meta endpoint and a direct WebSocket open to diagnose timeout issues.</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runConnectionProbe} disabled={isLoading || isRunningConnectionProbe}>
								<Play size={16} />
								{isRunningConnectionProbe ? "Running..." : "Run check"}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Run handshake status check</div>
								<p class="text-xs opacity-70">Reads the latest worker `sync.status` payload (stage, reason, acknowledgment version).</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runHandshakeStatusCheck} disabled={isLoading || isRunningHandshakeCheck}>
								<Play size={16} />
								{isRunningHandshakeCheck ? "Running..." : "Run check"}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Check sync URL/config sanity</div>
								<p class="text-xs opacity-70">Validates DB ID, sync URL format, protocol, and derived meta URL.</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runSyncConfigSanityCheck} disabled={isLoading || isRunningSanityCheck}>
								<Play size={16} />
								{isRunningSanityCheck ? "Running..." : "Run check"}
							</button>
						</div>
					</div>
				</div>
				{#if connectionProbe}
					<div class="mt-3 rounded border border-base-300 bg-base-200/40 p-3 text-xs">
						<div class="mb-2 flex items-center justify-between gap-2">
							<div class="font-semibold">Last connection probe</div>
							<div class="flex items-center gap-1">
								<button class="btn-neutral btn btn-xs" on:click={copyConnectionProbeResult}>
									<Download size={14} />
									Copy
								</button>
								<button class="btn-outline btn btn-xs" on:click={clearConnectionProbeResult}>Clear</button>
							</div>
						</div>
						<div class="grid gap-1">
							<div>Time: {new Date(connectionProbe.at).toLocaleTimeString()}</div>
							<div>Sync active: {String(connectionProbe.syncActive)}</div>
							<div class="truncate">DB ID: {connectionProbe.dbid}</div>
							<div class="truncate">Sync URL: {connectionProbe.syncUrl}</div>
							<div class="truncate">
								Meta: {connectionProbe.meta.ok ? "OK" : "FAIL"} | status {connectionProbe.meta.status ?? "n/a"} | {connectionProbe.meta.latencyMs} ms
								{connectionProbe.meta.error ? ` | ${connectionProbe.meta.error}` : ""}
							</div>
							<div class="truncate">
								WebSocket: {connectionProbe.ws.ok ? "OK" : "FAIL"} | close {connectionProbe.ws.closeCode ?? "n/a"} | {connectionProbe.ws.latencyMs} ms
								{connectionProbe.ws.error ? ` | ${connectionProbe.ws.error}` : ""}
							</div>
							{#if connectionProbe.meta.bodySnippet}
								<div class="truncate opacity-70">Meta body snippet: {connectionProbe.meta.bodySnippet}</div>
							{/if}
						</div>
					</div>
				{/if}
				{#if handshakeStatusCheck}
					<div class="mt-3 rounded border border-base-300 bg-base-200/40 p-3 text-xs">
						<div class="mb-2 flex items-center justify-between gap-2">
							<div class="font-semibold">Last handshake status check</div>
							<div class="flex items-center gap-1">
								<button class="btn-neutral btn btn-xs" on:click={copyHandshakeStatusCheckResult}>
									<Download size={14} />
									Copy
								</button>
								<button class="btn-outline btn btn-xs" on:click={clearHandshakeStatusCheckResult}>Clear</button>
							</div>
						</div>
						<div class="grid gap-1">
							<div>Time: {new Date(handshakeStatusCheck.at).toLocaleTimeString()}</div>
							<div>Result: {handshakeStatusCheck.ok ? "OK" : "FAIL"}{handshakeStatusCheck.timedOut ? " (timed out)" : ""}</div>
							<div>Stage: {handshakeStatusCheck.stage || "n/a"}</div>
							<div>Acknowledgment DB version: {handshakeStatusCheck.ackDbVersion ?? "n/a"}</div>
							<div>Reason: {handshakeStatusCheck.reason || "n/a"}</div>
							<div class="truncate">Message: {handshakeStatusCheck.message || "n/a"}</div>
						</div>
					</div>
				{/if}
				{#if syncConfigSanity}
					<div class="mt-3 rounded border border-base-300 bg-base-200/40 p-3 text-xs">
						<div class="mb-2 flex items-center justify-between gap-2">
							<div class="font-semibold">Last sync config sanity check</div>
							<div class="flex items-center gap-1">
								<button class="btn-neutral btn btn-xs" on:click={copySyncConfigSanityResult}>
									<Download size={14} />
									Copy
								</button>
								<button class="btn-outline btn btn-xs" on:click={clearSyncConfigSanityResult}>Clear</button>
							</div>
						</div>
						<div class="grid gap-1">
							<div>Time: {new Date(syncConfigSanity.at).toLocaleTimeString()}</div>
							<div>Sync active: {String(syncConfigSanity.syncActive)}</div>
							<div class="truncate">DB ID: {syncConfigSanity.dbid || "n/a"}</div>
							<div class="truncate">Sync URL: {syncConfigSanity.syncUrl || "n/a"}</div>
							<div class="truncate">Derived meta URL: {syncConfigSanity.metaUrl || "n/a"}</div>
							<div>WS protocol valid: {String(syncConfigSanity.wsUrlOk)}</div>
							<div>Issues: {syncConfigSanity.problems.length}</div>
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
				<h2 class="text-lg font-semibold">Recovery</h2>
				<p class="mb-3 text-sm opacity-70">Use the least destructive fix first.</p>
				<div class="grid gap-2 md:grid-cols-2">
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Restart sync worker</div>
								<p class="text-xs opacity-70">Stops and starts the sync worker to recover from temporary worker/network issues.</p>
							</div>
							<button class="btn-success btn btn-sm shrink-0 self-start w-36 justify-center" on:click={restartSyncWorker} disabled={isLoading}>
								<RotateCcw size={16} />
								Run action
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Reset compatibility identity</div>
								<p class="text-xs opacity-70">Clears remembered remote site ID for this DB and re-runs strict compatibility checks.</p>
							</div>
							<button class="btn-success btn btn-sm shrink-0 self-start w-36 justify-center" on:click={fixCorruptSyncState} disabled={isLoading}>
								<RotateCcw size={16} />
								Run action
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Run manual auto-recovery</div>
								<p class="text-xs opacity-70">Runs quick DB check + strict compatibility check and restarts sync if stale/blocked.</p>
							</div>
							<button class="btn-success btn btn-sm shrink-0 self-start w-36 justify-center" on:click={runManualAutoRecovery} disabled={isLoading}>
								<RotateCcw size={16} />
								Run action
							</button>
						</div>
					</div>
					<div class="rounded border border-red-400/60 bg-red-50/20 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Nuke and resync now</div>
								<p class="text-xs opacity-70">Destructive: deletes local DB and re-downloads state from remote.</p>
							</div>
							<button
								class="btn btn-sm shrink-0 self-start w-36 justify-center border-red-800 bg-red-700 text-white hover:bg-red-800"
								on:click={nukeAndResyncNow}
								disabled={isLoading}
							>
								<AlertTriangle size={16} />
								Run action
							</button>
						</div>
					</div>
				</div>
			</section>

			<section class="border-b border-base-300 pb-6">
				<h2 class="text-lg font-semibold">Inject Problems</h2>
				<p class="mb-3 text-sm opacity-70">Force failures to test resilience and recovery flows.</p>
				<div class="grid gap-2 md:grid-cols-2">
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Inject sync transport failure</div>
								<p class="text-xs opacity-70">Temporarily points sync to an unreachable URL to force connection errors. Run again to restore.</p>
							</div>
							<button class="btn-warning btn btn-sm shrink-0 self-start w-36 justify-center" on:click={toggleSyncTransportFailure} disabled={isLoading}>
								<Unplug size={16} />
								{$syncUrlConfig === INJECTED_SYNC_FAILURE_URL ? "Restore" : "Run action"}
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Corrupt local site identity</div>
								<p class="text-xs opacity-70">Writes a random value into local `crsql_site_id` and remembered identity to force compatibility mismatch.</p>
							</div>
							<button class="btn-warning btn btn-sm shrink-0 self-start w-36 justify-center" on:click={corruptSyncState} disabled={isLoading}>
								<Unplug size={16} />
								Run action
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Trigger load error</div>
								<p class="text-xs opacity-70">Navigates to the load error route to test error-state handling.</p>
							</div>
							<button class="btn-warning btn btn-sm shrink-0 self-start w-36 justify-center" on:click={triggerLoadError} disabled={isLoading}>
								<AlertTriangle size={16} />
								Run action
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Trigger runtime error</div>
								<p class="text-xs opacity-70">Throws a runtime exception for testing crash/error boundaries.</p>
							</div>
							<button class="btn-warning btn btn-sm shrink-0 self-start w-36 justify-center" on:click={throwError} disabled={isLoading}>
								<AlertTriangle size={16} />
								Run action
							</button>
						</div>
					</div>
				</div>
			</section>

			<section class="border-b border-base-300 pb-6">
				<h2 class="text-lg font-semibold">Data Tools</h2>
				<p class="mb-3 text-sm opacity-70">Seed/reset/export helpers, table exploration, and custom query execution.</p>
				<div class="grid gap-2 md:grid-cols-2">
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Export state</div>
								<p class="text-xs opacity-70">Exports current local app state archive for debugging.</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={handleExportState} disabled={isLoading}>
								<Download size={16} />
								Export
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Export sync diagnostics</div>
								<p class="text-xs opacity-70">Downloads runtime sync diagnostics JSON (also copied to clipboard when allowed).</p>
							</div>
							<button class="btn-neutral btn btn-sm shrink-0 self-start w-36 justify-center" on:click={exportSyncDiagnostics} disabled={isLoading}>
								<Download size={16} />
								Export
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Populate database</div>
								<p class="text-xs opacity-70">Inserts debug seed data for quick local testing.</p>
							</div>
							<button class="btn-success btn btn-sm shrink-0 self-start w-36 justify-center" on:click={() => populateDatabase()} disabled={isLoading}>
								<Plus size={16} />
								Run action
							</button>
						</div>
					</div>
					<div class="rounded border border-base-300 bg-base-100 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Upsert 100 books</div>
								<p class="text-xs opacity-70">Adds deterministic sample books and publisher/supplier links.</p>
							</div>
							<button class="btn-success btn btn-sm shrink-0 self-start w-36 justify-center" on:click={() => upsert100Books()} disabled={isLoading}>
								<BookPlus size={16} />
								Run action
							</button>
						</div>
					</div>
					<div class="rounded border border-red-400/60 bg-red-50/20 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="text-sm font-semibold">Reset database</div>
								<p class="text-xs opacity-70">Destructive: deletes all rows from core local business tables (books, customers, suppliers, orders).</p>
							</div>
							<button
								class="btn btn-sm shrink-0 self-start w-36 justify-center border-red-800 bg-red-700 text-white hover:bg-red-800"
								on:click={() => resetDatabase()}
								disabled={isLoading}
							>
								<RotateCcw size={16} />
								Run action
							</button>
						</div>
					</div>
				</div>
				<div class="mt-4 space-y-4 border-t border-base-300 pt-4">
					<div>
						<h3 class="mb-2 text-base font-semibold">Table Explorer</h3>
						<div class="space-y-3">
							{#if isLoading}
								<div class="spinner"></div>
							{:else if tableExplorerData.length === 0}
								<p class="text-sm opacity-70">No tables found.</p>
							{:else}
								<select class="select select-bordered w-full" value={selectedExplorerTable || ""} on:change={handleExplorerTableChange} disabled={isTableLoading}>
									<option value="">Select table</option>
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
										{selectedExplorerTableRowCount} row{selectedExplorerTableRowCount === 1 ? "" : "s"} total. Showing up to {TABLE_PREVIEW_LIMIT}.
									</div>
									{#if selectedExplorerTableRows.length === 0}
										<p class="text-sm opacity-70">No rows.</p>
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
						<h3 class="mb-2 text-base font-semibold">Database Query Interface</h3>
						<div class="mb-2 flex flex-col gap-2">
							<textarea bind:value={query} id="query"></textarea>
							<button class="btn-warning btn w-fit" on:click={executeQuery} disabled={isLoading}>
								<Play size={20} />
								{isLoading ? "Executing..." : "Run Query"}
							</button>
						</div>
						<div class="max-h-[50vh] overflow-auto">
							{#if queryResult || errorMessage}
								<h2 class="mb-3 text-sm font-semibold">Query Results:</h2>

								{#if errorMessage}
									<div class="rounded-lg bg-red-500 p-3 text-white shadow">
										{errorMessage}
									</div>
								{:else if queryResult.length === 0}
									<p>No results found.</p>
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
		throw new Error("Kaboom! Render time error");
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

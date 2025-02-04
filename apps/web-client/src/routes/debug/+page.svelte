<script lang="ts">
	import { BookCopy, Library, PackageMinus, Search, Settings, PersonStanding, Book, Truck } from "lucide-svelte";
	import { Plus, RotateCcw } from "lucide-svelte";
	import { LL } from "$i18n/i18n-svelte";
	import { appPath } from "$lib/paths";
	import { TooltipWrapper } from "$lib/components";
	import { onMount } from "svelte";
	import { page } from "$app/stores";
	import { getInitializedDB } from "$lib/db/cr-sqlite";
	import { dbNamePersisted } from "$lib/db";

	import exampleData from "./example_data";

	$: ({ nav: tNav } = $LL);

	interface Link {
		label: string;
		href: string;
		icon: any;
	}

	let book;
	let supplier;
	let supplier_publisher;
	let customer;
	let customer_order_lines;
	let supplier_order;
	let supplier_order_line;
	let reconciliation_order;

	let isLoading = true;

	const tableData = [
		{ label: "Books", value: () => book },
		{ label: "Suppliers", value: () => supplier },
		{ label: "Supplier Publishers", value: () => supplier_publisher },
		{ label: "Customers", value: () => customer },
		{ label: "Customer Order Lines", value: () => customer_order_lines },
		{ label: "Supplier Orders", value: () => supplier_order },
		{ label: "Supplier Order Lines", value: () => supplier_order_line },
		{ label: "Reconciliation Orders", value: () => reconciliation_order }
	];

	let links: Link[];
	$: links = [
		{
			label: tNav.search(),
			href: appPath("stock"),
			icon: Search
		},
		{
			label: tNav.inventory(),
			href: appPath("inventory"),
			icon: Library
		},
		{
			label: tNav.outbound(),
			href: appPath("outbound"),
			icon: PackageMinus
		},
		{
			label: tNav.settings(),
			href: appPath("settings"),
			icon: Settings
		},
		{
			label: tNav.history(),
			href: appPath("history/date"),
			icon: Book
		},
		{
			label: "Customers",
			href: appPath("customers"),
			icon: PersonStanding
		},
		{
			label: tNav.supplier_orders(),
			href: appPath("supplier_orders"),
			icon: Truck
		}
	];

	$: dbName = $dbNamePersisted;

	const populateDatabase = async function () {
		const db = await getInitializedDB(dbName);
		console.log("Populating database");
		await db.db.exec(exampleData);
		console.log("Finished populating database.");
		await loadData();
	};

	const resetDatabase = async function resetDatabase() {
		const db = await getInitializedDB(dbName);
		const tables = [
			"book",
			"supplier",
			"supplier_publisher",
			"customer",
			"customer_order_lines",
			"supplier_order",
			"supplier_order_line",
			"reconciliation_order"
		];
		console.log("Resetting database");

		await Promise.all(
			tables.map(async (table) => {
				console.log(`Clearing ${table}`);
				await db.db.exec(`DELETE FROM ${table}`);
			})
		);
		await loadData();
	};

	const loadData = async function () {
		console.log("Loading database");

		isLoading = true;

		const db = await getInitializedDB(dbName);

		book = await db.db.exec("SELECT COUNT(*) from book;");
		supplier = await db.db.exec("SELECT COUNT(*) from supplier;");
		supplier_publisher = await db.db.exec("SELECT COUNT(*) from supplier_publisher;");
		customer = await db.db.exec("SELECT COUNT(*) from customer;");
		customer_order_lines = await db.db.exec("SELECT COUNT(*) from customer_order_lines;");
		supplier_order = await db.db.exec("SELECT COUNT(*) from supplier_order;");
		supplier_order_line = await db.db.exec("SELECT COUNT(*) from supplier_order_line;");
		reconciliation_order = await db.db.exec("SELECT COUNT(*) from reconciliation_order;");

		isLoading = false;
	};

	onMount(async function () {
		await loadData();
	});
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<!-- Sidenav -->
	<div class="flex">
		<div class="hidden h-screen sm:inline-block">
			<div class="block px-6 py-4">
				<BookCopy color="white" strokeWidth={2} size={36} />
			</div>

			<nav class="px-3" aria-label="Main navigation">
				<ul class="flex flex-col items-center gap-y-3">
					{#each links as { label, icon, href }}
						<TooltipWrapper
							options={{
								positioning: {
									placement: "right"
								},
								openDelay: 0,
								closeDelay: 0,
								closeOnPointerDown: true,
								forceVisible: true
							}}
							let:trigger
						>
							<li {...trigger} use:trigger.action>
								<a {href} class="inline-block rounded-sm p-4 {$page.url.pathname.startsWith(href)}">
									<svelte:component this={icon} size={24} />
								</a>
							</li>

							<p slot="tooltip-content" class="px-4 py-1 text-white">{label}</p>
						</TooltipWrapper>
					{/each}
				</ul>
			</nav>
		</div>
	</div>
	<!-- Sidenav end -->

	<!-- Main content -->
	<div id="content" class="relative flex h-full w-full flex-col overflow-hidden">
		<!-- Main section -->

		<header class="navbar bg-neutral mb-4">
			<input type="checkbox" value="forest" class="theme-controller toggle" />
		</header>

		<main class="h-screen">
			<div class="relative mx-auto flex h-full flex-col gap-y-10 px-4">
				<div class="flex items-center justify-between">
					<h1 class="prose font-bold">Debug</h1>
					<div class="gap-2">
						<button class="btn-primary btn" on:click={() => populateDatabase()}>
							<Plus size={20} />
							Populate Database
						</button>
						<button class="btn-primary btn" on:click={() => resetDatabase()}>
							<RotateCcw size={20} />
							Reset Database
						</button>
					</div>
				</div>

				<div class="flex flex-col gap-y-10 overflow-x-auto py-2">
					<table class="table">
						<thead>
							<tr>
								<th scope="col">Table</th>
								<th scope="col">Number of objects</th>
							</tr>
						</thead>
						<tbody>
							{#each tableData as row}
								<tr class="hover focus-within:bg-base-200">
									<td>{row.label}</td>
									<td>
										{#if isLoading}
											<div class="spinner"></div>
										{:else}
											{row.value()}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="flex h-8 items-center justify-end border-t px-4">
				<slot name="footer" />
			</div>
		</main>
		<!-- Main section end -->
	</div>
</div>

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
</style>

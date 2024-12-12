<script lang="ts">
	import {
		BookCopy,
		Library,
		PackageMinus,
		Search,
		Settings,
		PersonStanding,
		ArrowLeftToLine,
		QrCode,
		Book,
		Truck,
		Bug
	} from "lucide-svelte";
	import { Plus, RotateCcw } from "lucide-svelte";
	import { LL } from "$i18n/i18n-svelte";
	import { appPath } from "$lib/paths";
	import { TooltipWrapper } from "$lib/components";
	import { browser } from "$app/environment";
	import { onMount } from "svelte";
	import { redirect, type Load } from "@sveltejs/kit";
	import { page } from "$app/stores";
	import { getInitializedDB } from "$lib/db/orders";
	import { upsertBook } from "$lib/db/orders/books";
	import { upsertSupplier } from "$lib/db/orders/suppliers";

	import type { Book as BookType } from "$lib/db/orders/books";
	import type { Supplier } from "$lib/db/orders/types";

	$: ({ nav: tNav } = $LL);

	interface Link {
		label: string;
		href: string;
		icon: any;
	}

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
		},
		{
			label: tNav.debug(),
			href: appPath("debug"),
			icon: Bug
		}
	];

	const exampleData = {
		books: [
			{
				isbn: "9781234567897",
				title: "The Art of Learning",
				authors: "Josh Waitzkin",
				publisher: "Free Press",
				price: 15.99
			},
			{
				isbn: "9788804797142",
				title: "Lord of the Flies",
				authors: "William Golding",
				publisher: "Mondadori",
				price: 18.0
			}
		],
		suppliers: [
			{
				id: 1,
				name: "Il Libraio Cuneo",
				email: "libraio@example.com",
				address: "Via XX Settembre, 5 - 12100 Cuneo"
			}
		],
		publishers: [
			{
				supplier_id: 1,
				publisher: "Free Press"
			},
			{
				supplier_id: 1,
				publisher: "Mondadori"
			}
		]
	};

	const populateDatabase = async function populateDatabase() {
		const ordersDb = await getInitializedDB("librocco-current-db");
		console.log("Populating database");
		for (const rawBook of exampleData.books) {
			try {
				const book: BookType = {
					isbn: rawBook.isbn,
					title: rawBook.title,
					authors: rawBook.authors,
					publisher: rawBook.publisher,
					price: rawBook.price
				};

				await upsertBook(ordersDb, book);
				console.log(`Upserted book: ${book.isbn}`);
			} catch (error) {
				console.error(`Error upserting book with ISBN ${rawBook.isbn}:`, error);
			}
		}

		for (const rawSupplier of exampleData.suppliers) {
			try {
				const supplier: Supplier = {
					id: rawSupplier.id,
					name: rawSupplier.name,
					email: rawSupplier.email,
					address: rawSupplier.address
				};

				await upsertSupplier(ordersDb, supplier);
				console.log(`Upserted supplier: ${supplier.name}`);
			} catch (error) {
				console.error(`Error upserting supplier with name ${rawSupplier.name}:`, error);
			}
		}
		console.log("Finished populating database.");
		loadData();
	};

	const tables: string[] = ["book", "supplier_publisher", "supplier", "customer"];

	const resetDatabase = async function resetDatabase() {
		const ordersDb = await getInitializedDB("librocco-current-db");
		console.log("Resetting database");

		tables.forEach((table) => {
			(async function () {
				console.log(`Clearing ${table}`);
				await ordersDb.exec(`DELETE FROM ${table}`);
			})();
		});
		loadData();
	};

	let books;
	let publishers;
	let customers;
	let orders;
	let suppliers;

	let isLoading = true;

	const tableData = [
		{ label: "Books", value: () => books },
		{ label: "Publishers", value: () => publishers },
		{ label: "Suppliers", value: () => suppliers },
		{ label: "Orders", value: () => orders },
		{ label: "Customers", value: () => customers }
	];

	const loadData = async function () {
		console.log("Loading database");

		isLoading = true;

		const ordersDb = await getInitializedDB("librocco-current-db");
		books = await ordersDb.exec("SELECT COUNT(*) from book;");
		publishers = await ordersDb.exec("SELECT COUNT(*) from supplier_publisher;");
		customers = await ordersDb.exec("SELECT COUNT(*) from customer;");
		orders = await ordersDb.exec("SELECT COUNT(*) from customer_supplier_order;");
		suppliers = await ordersDb.exec("SELECT COUNT(*) from supplier;");

		isLoading = false;
	};

	onMount(() => {
		loadData();
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

		<header class="navbar mb-4 bg-neutral">
			<input type="checkbox" value="forest" class="theme-controller toggle" />
		</header>

		<main class="h-screen">
			<div class="mx-auto flex h-full max-w-5xl flex-col gap-y-10 px-4">
				<div class="flex items-center justify-between">
					<h1 class="prose text-2xl font-bold">Debug</h1>
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

				<div class="flex flex-col gap-y-6 overflow-x-auto py-2">
					<table class="table-lg table">
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
		margin: auto;
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

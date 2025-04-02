<script lang="ts">
	import { BookCopy, Library, PackageMinus, Search, Settings, PersonStanding, ArrowLeftToLine, QrCode, Book, Truck } from "lucide-svelte";
	import { fade, fly } from "svelte/transition";
	import { createDialog, melt } from "@melt-ui/svelte";

	import type { LayoutData } from "../$types";

	import { LL } from "@librocco/shared/i18n-svelte";

	import { goto } from "$lib/utils/navigation";
	import { TooltipWrapper } from "$lib/components";
	import { appPath } from "$lib/paths";

	import { page } from "$app/stores";
	import { createOutboundNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";

	export let data: LayoutData;

	// #region reactivity

	$: db = data.dbCtx?.db;

	interface Link {
		label: string;
		href: string;
		icon: any;
	}

	$: ({ nav: tNav } = $LL);

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

	const {
		elements: { trigger, overlay, content, close: closeMobileMenu, portalled },
		states: { open: mobilMenuOpen }
	} = createDialog({
		forceVisible: true
	});

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateNote = async () => {
		const id = await getNoteIdSeq(db);
		await createOutboundNote(db, id);

		await goto(appPath("outbound", id));
	};
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
		<main class="relative flex h-full w-full flex-col justify-between overflow-hidden bg-white">
			<div class="relative h-full w-full overflow-y-auto">
				<slot />
			</div>

			<div class="flex h-8 items-center justify-end border-t px-4">
				<slot name="footer" />
			</div>
		</main>
		<!-- Main section end -->
	</div>
</div>

{#if $mobilMenuOpen}
	<!-- Mobile menu overlay -->
	<div use:melt={$portalled}>
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}>
			<div
				use:melt={$content}
				class="fixed bottom-0 left-0 top-0 z-50 h-full w-2/3 min-w-[256px] overflow-y-auto"
				transition:fly|global={{
					x: -350,
					duration: 300,
					opacity: 1
				}}
			>
				<div class="my-5 flex items-center px-4 text-white">
					<BookCopy class="mr-[5px]" size={36} />
					<p class="text-2xl font-extrabold leading-8 tracking-tight text-white">Libraio</p>
					<button use:melt={$closeMobileMenu} class="ml-auto block">
						<ArrowLeftToLine size={24} />
					</button>
				</div>

				<!-- Nav -->
				<nav class="px-2">
					<ul class="mb-20">
						{#each links as { label, icon, href }}
							<li>
								<a {href} class="mb-1 flex items-center rounded-md p-2 pr-3 {$page.url.pathname.startsWith(href)}">
									<svelte:component this={icon} class="mr-3" size={24} />
									<span class="text-sm font-medium leading-5">{label}</span>
								</a>
							</li>
						{/each}
					</ul>

					<button on:click={handleCreateNote} class="flex gap-3 p-2 pr-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-md">
							<QrCode size={24} class="text-black" />
						</div>
						<div>
							<p class="text-sm font-medium leading-5">{$LL.orders_page.checkout}</p>
							<p class="text-xs font-normal leading-4">{$LL.orders_page.checkout}</p>
						</div>
					</button>
				</nav>
				<!-- Nav end -->
			</div>
		</div>
	</div>
{/if}

<!-- Mobile menu overlay end -->

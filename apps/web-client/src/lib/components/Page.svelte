<script lang="ts">
	import { BookCopy, Library, PackageMinus, Search, Settings, AlignLeft as Menu, ArrowLeftToLine, QrCode } from "lucide-svelte";
	import { fade, fly } from "svelte/transition";
	import { createDialog, melt } from "@melt-ui/svelte";

	import { testId, type WebClientView } from "@librocco/shared";

	import { page } from "$app/stores";
	import { goto } from "$app/navigation";

	import { TooltipWrapper } from "$lib/components";

	import { appPath } from "$lib/paths";
	// import { noteToastMessages, toastSuccess } from "$lib/toasts";
	import { getDB } from "$lib/db";

	interface Link {
		label: string;
		href: string;
		icon: any;
		// This is used purely for testing purposes
		linkto?: WebClientView;
	}

	export const links: Link[] = [
		{
			label: "Search stock",
			href: appPath("stock"),
			icon: Search,
			linkto: "stock"
		},
		{
			label: "Manage inventory",
			href: appPath("inventory"),
			icon: Library,
			linkto: "inventory"
		},
		{
			label: "Outbound",
			href: appPath("outbound"),
			icon: PackageMinus,
			linkto: "outbound"
		},
		{
			label: "Settings",
			href: appPath("settings"),
			icon: Settings,
			linkto: "settings"
		}
	];

	export let view: WebClientView;
	export let loaded: boolean;

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
		const note = await getDB()?.warehouse().note().create();
		// TODO: Check this: this causes problems, stating that toastSuccess is not a function.
		// For now we can live without the notification here as we'll be redirected to the note page,
		// but it would be nice to fix.
		//
		// toastSuccess(noteToastMessages("Note").outNoteCreated);
		await goto(appPath("outbound", note._id));
	};
</script>

<div id={testId("page-container")} data-view={view} data-loaded={loaded} class="flex h-screen w-screen overflow-hidden">
	<!-- Sidenav -->
	<div class="flex">
		<div class="hidden h-screen bg-gray-800 sm:inline-block">
			<div class="block px-6 py-4">
				<BookCopy color="white" strokeWidth={2} size={36} />
			</div>

			<nav class="px-3" aria-label="Main navigation">
				<ul class="flex flex-col items-center gap-y-3">
					{#each links as { label, icon, href, linkto }}
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
								<a
									data-linkto={linkto}
									{href}
									class="inline-block rounded-sm p-4 text-gray-400 {$page.url.pathname.startsWith(href)
										? 'bg-gray-900'
										: 'hover:bg-gray-700'}"
								>
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
	<div id="content" data-loaded={loaded} class="relative flex h-screen w-full flex-col overflow-hidden bg-gray-50">
		<!-- Top bar input -->
		<div
			class="relative flex h-16 w-full flex-shrink-0 items-center bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.6),0px_1px_3px_0px_rgba(0,0,0,0.1)] sm:h-[66px]"
		>
			<!-- SM size menu icon -->
			<button use:melt={$trigger} class="flex h-full w-14 flex-shrink-0 items-center justify-center border-r border-gray-200 sm:hidden">
				<Menu size={24} />
			</button>
			<!-- SM size menu icon end -->

			<!-- Top bar input -->
			<div class="flex h-full w-full items-center px-4 focus-within:ring-2 focus-within:ring-inset">
				<slot
					name="topbar"
					iconProps={{ class: "text-gray-400", size: 24 }}
					inputProps={{ class: "w-full border-0 focus:outline-none focus:ring-0" }}
				/>
			</div>
			<!-- Top bar input end -->
		</div>
		<!-- Topbar container end -->

		<!-- Heading section -->
		<header class="w-full px-4 pt-5 pb-6 xs:px-8">
			<slot name="heading" />
		</header>
		<!-- Heading section end -->

		<!-- Main section -->
		<main class="relative h-full w-full overflow-y-auto border-t bg-white">
			<slot name="main" />
		</main>
		<!-- Main section end -->
	</div>
</div>

<!-- Mobile menu overlay -->
<div use:melt={$portalled}>
	{#if $mobilMenuOpen}
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}>
			<div
				use:melt={$content}
				class="fixed left-0 top-0 bottom-0 z-50 h-full w-2/3 min-w-[256px] overflow-y-auto bg-gray-900"
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
								<a
									{href}
									class="mb-1 flex items-center rounded-md p-2 pr-3 {$page.url.pathname.startsWith(href)
										? 'bg-gray-200'
										: 'hover:bg-gray-700'}"
								>
									<svelte:component this={icon} class="mr-3 text-gray-400" size={24} />
									<span class="text-sm font-medium leading-5 text-gray-600">{label}</span>
								</a>
							</li>
						{/each}
					</ul>

					<button on:click={handleCreateNote} class="flex gap-3 p-2 pr-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-md bg-gray-50">
							<QrCode size={24} class="text-black" />
						</div>
						<div>
							<p class="text-sm font-medium leading-5 text-gray-50">Checkout</p>
							<p class="text-xs font-normal leading-4 text-gray-400">Create a new outbound note</p>
						</div>
					</button>
				</nav>
				<!-- Nav end -->
			</div>
		</div>
	{/if}
</div>
<!-- Mobile menu overlay end -->

<script lang="ts">
	import { BookCopy, Library, PackageMinus, Search, Settings } from "lucide-svelte";

	import type { WebClientView } from "@librocco/shared";

	import { page } from "$app/stores";

	import { TooltipWrapper } from "$lib/components";

	import { appPath } from "$lib/paths";

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
			linkto: "search"
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

	export let view: WebClientView | undefined = undefined;
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<!-- Sidenav -->
	<div class="flex">
		<div class="inline-block h-screen bg-gray-800">
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
	<div id="content" data-view={view} class="relative flex h-screen w-full flex-col overflow-hidden bg-gray-50">
		<!-- Top bar input -->
		<div
			class="relative flex h-[66px] w-full flex-shrink-0 items-center bg-white px-4 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.6),0px_1px_3px_0px_rgba(0,0,0,0.1)] focus-within:ring-2 focus-within:ring-inset"
		>
			<slot
				name="topbar"
				iconProps={{ class: "text-gray-400", size: 24 }}
				inputProps={{ class: "w-full border-0 focus:outline-none focus:ring-0" }}
			/>
		</div>
		<!-- Top bar input end -->

		<!-- Heading section -->
		<header class="w-full px-8 pt-5 pb-6">
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

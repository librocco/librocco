<script lang="ts">
	import { BookCopy, Library, Package, Search, Settings } from "lucide-svelte";

	import { base } from "$app/paths";
	import { page } from "$app/stores";

	const basepath = `${base}/proto`;

	export const links = [
		{
			label: "Stock",
			href: `${basepath}/stock/`,
			icon: Search
		},
		{
			label: "Manage inventory",
			href: `${basepath}/inventory/`,
			icon: Library
		},
		{
			label: "Outbound",
			href: `${basepath}/outbound/`,
			icon: Package
		},
		{
			label: "Settings",
			href: `${basepath}/settings/`,
			icon: Settings
		}
	];
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
					{#each links as { icon, href }}
						<li>
							<a
								{href}
								class="inline-block rounded-sm p-4 text-gray-400 {$page.url.pathname.startsWith(href)
									? 'bg-gray-900'
									: 'hover:bg-gray-700'}"
							>
								<svelte:component this={icon} size={24} />
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>
	</div>
	<!-- Sidenav end -->

	<!-- Main content -->
	<div class="relative flex h-full w-full flex-col overflow-hidden bg-gray-50">
		<!-- Top bar input -->
		<div
			class="relative flex h-[66px] w-full items-center bg-white px-4 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.6),0px_1px_3px_0px_rgba(0,0,0,0.1)] focus-within:ring-2 focus-within:ring-inset"
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

		<slot />

		<!-- Main section -->
		<main class="relative h-full w-full border-t bg-white">
			<slot name="main" />
		</main>
		<!-- Main section end -->
	</div>
</div>

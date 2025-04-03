<script lang="ts">
	import { Search, ScanBarcode } from "lucide-svelte";

	export let title: string;
	export let handleCreateOutboundNote: (e: Event) => void;
	export let handleSearch: (e: Event) => void;
</script>

<!-- Main content -->
<div id="content" class="relative flex h-full w-full flex-col overflow-hidden">
	<header class="border-base-content flex h-16 items-center justify-between border-b">
		<h2 class="pl-[70px] text-lg font-medium lg:pl-5">{title}</h2>
		<!-- TODO: add strings to dicts -->
		<div class="flex gap-x-2 p-4">
			<button class="btn-seconday btn-sm btn lg:hidden" on:click={handleSearch}>
				<Search size={18} />
				Stock
			</button>
			<button class="btn-primary btn-sm btn" on:click={handleCreateOutboundNote}>
				<ScanBarcode size={18} />
				Checkout
			</button>
		</div>
	</header>

	{#if $$slots.topbar}
		<!-- Top bar input -->
		<div
			class="relative flex h-16 w-full flex-shrink-0 items-center bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.6),0px_1px_3px_0px_rgba(0,0,0,0.1)] sm:h-[66px]"
		>
			<!-- Top bar input -->
			<div class="relative flex h-full w-full items-center px-4 focus-within:ring-2 focus-within:ring-inset">
				<slot
					name="topbar"
					iconProps={{ class: "text-gray-400", size: 24 }}
					inputProps={{ class: "w-full border-0 focus:outline-none focus:ring-0" }}
				/>
			</div>
			<!-- Top bar input end -->
		</div>
		<!-- Topbar container end -->
	{/if}

	<!-- Heading section -->
	{#if $$slots.heading}
		<header class="xs:px-8 w-full px-4 pb-6 pt-5">
			<slot name="heading" />
		</header>
	{/if}
	<!-- Heading section end -->

	<!-- Main section -->
	<main class="relative flex h-full w-full flex-col justify-between overflow-hidden border-t bg-white">
		<div class="relative h-full w-full overflow-y-auto">
			<slot name="main" />
		</div>

		<div class="flex h-8 items-center justify-end border-t bg-gray-100 px-4">
			<slot name="footer" />
		</div>
	</main>
	<!-- Main section end -->
</div>

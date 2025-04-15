<script lang="ts">
	import { Search, ScanBarcode } from "lucide-svelte";

	import { testId, type WebClientView } from "@librocco/shared";

	export let view: WebClientView;
	export let title: string;

	export let handleCreateOutboundNote: (e: Event) => void;
	export let handleSearch: (e: Event) => void;
</script>

<!-- Main content -->
<div data-view={view} id={testId("page-container")} class="h-full w-full">
	<div class="flex h-full w-full flex-col overflow-y-auto" id="content">
		<div class="bg-base-200 border-base-content sticky top-0 z-[100] flex h-16 items-center justify-between border-b">
			<h1 class="pl-[70px] text-lg font-medium lg:pl-5">{title}</h1>
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
		</div>

		{#if $$slots.topbar}
			<!-- Top bar input -->
			<div
				class="flex w-full basis-16 items-center bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.6),0px_1px_3px_0px_rgba(0,0,0,0.1)] sm:h-[66px]"
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
		<main class="flex h-full w-full flex-col justify-between divide-y" id="content">
			<div class="h-full w-full">
				<slot name="main" />
			</div>

			<div class="bg-base-200 sticky bottom-0 flex basis-8 items-center justify-end border-t px-4">
				<slot name="footer" />
			</div>
		</main>
		<!-- Main section end -->
	</div>
</div>

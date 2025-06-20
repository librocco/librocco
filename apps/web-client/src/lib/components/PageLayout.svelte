<script lang="ts">
	import Search from "$lucide/search";
	import ScanBarcode from "$lucide/scan-barcode";

	import { testId, type WebClientView } from "@librocco/shared";
	import LL from "@librocco/shared/i18n-svelte";

	export let view: WebClientView;
	export let title: string;

	export let handleCreateOutboundNote: (e: Event) => void;
	export let handleSearch: (e: Event) => void;
</script>

<!-- Main content -->
<div data-view={view} id={testId("page-container")} class="h-full w-full">
	<div class="flex h-full w-full flex-col overflow-y-auto" id="content">
		<div id="header" class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-base-content bg-base-200">
			<h1 class="pl-[70px] text-lg font-medium lg:pl-5">{title}</h1>
			<!-- TODO: add strings to dicts -->
			<div class="flex gap-x-2 p-4">
				<button class="btn-seconday btn-sm btn max-xs:hidden lg:hidden" on:click={handleSearch}>
					<Search size={18} />
					{$LL.misc_components.page_layout.stock()}
				</button>
				<button class="btn-primary btn-outline btn-sm btn" on:click={handleCreateOutboundNote}>
					<ScanBarcode size={18} />
					{$LL.misc_components.page_layout.checkout()}
				</button>
			</div>
		</div>

		<div class="flex h-full w-full flex-col justify-between divide-y" id="content">
			<slot name="main" />

			<div id="footer" class="sticky bottom-0 flex basis-8 items-center justify-end border-t bg-base-200 px-4">
				<slot name="footer" />
			</div>
		</div>
	</div>
</div>

<style>
	@media print {
		#header {
			display: none;
		}
		#footer {
			display: none;
		}
		#content {
			display: block;
		}
	}
</style>

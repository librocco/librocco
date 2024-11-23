<script lang="ts">
	import { Plus, Search, Trash, Loader2 as Loader, Library } from "lucide-svelte";

	import { ExtensionAvailabilityToast, Page, PlaceholderBox } from "$lib/components";

	import { appPath } from "$lib/paths";

	import { goto } from "$lib/utils/navigation";

	let initialized = true;
</script>

<Page view="orders/supplier_orders" loaded={initialized}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input on:focus={() => goto(appPath("stock"))} placeholder="Search orders" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="flex w-full items-center justify-between">
			<h1 class="text-2xl font-bold leading-7 text-gray-900">WIP: Supplier order page</h1>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if !initialized}
			<div class="center-absolute">
				<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
			</div>
		{:else}
			<PlaceholderBox title="WIP" description="Under construction" class="center-absolute" />
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast />
	</svelte:fragment>
</Page>

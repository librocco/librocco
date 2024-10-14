<script lang="ts">
	import { Search, Loader2 as Loader } from "lucide-svelte";

	import { goto } from "$lib/utils/navigation";

	import { Page, ExtensionAvailabilityToast } from "$lib/components";

	import { appPath } from "$lib/paths";

	import { LL } from "$i18n/i18n-svelte";

	$: ({ nav: tNav } = $LL);

	let initialized = true;
</script>

<Page view="orders/supplier_orders" loaded={initialized}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input on:focus={() => goto(appPath("stock"))} placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="flex w-full items-center justify-between">
			<h1 class="text-2xl font-bold leading-7 text-gray-900">{tNav.supplier_orders()}</h1>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<div class="center-absolute">
			<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
		</div>
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast />
	</svelte:fragment>
</Page>

<script lang="ts">
	import { onDestroy, onMount, setContext } from "svelte";
	import { invalidate } from "$app/navigation";
	import { page } from "$app/stores";
	import { racefreeGoto } from "$lib/utils/navigation";

	import Settings from "$lucide/settings";

	import type { LayoutData } from "./$types";
	import { appHash } from "$lib/paths";

	import { Page } from "$lib/controllers";

	import LL from "@librocco/shared/i18n-svelte";

	export let data: LayoutData;

	let disposer: () => void;
	onMount(() => {
		const disposer1 = data.dbCtx?.rx?.onRange(["book"], () => invalidate("books:data"));
		const disposer2 = data.dbCtx?.rx?.onRange(["supplier", "supplier_publisher"], () => invalidate("suppliers:data"));
		const disposer3 = data.dbCtx?.rx?.onRange(["customer_order_lines"], () => invalidate("customers:order_lines"));

		disposer = () => (disposer1(), disposer2(), disposer3());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer();
	});
	const goto = racefreeGoto(disposer);
	setContext("goto", goto);

	$: ({ plugins, placedOrders, reconcilingOrders, completedOrders } = data);
	$: db = data?.dbCtx?.db;

	$: hasPlacedOrders = placedOrders?.length;
	$: hasReconcilingOrders = reconcilingOrders?.length;
	$: hasCompletedOrders = completedOrders?.length;

	$: t = $LL.supplier_orders_page;
</script>

<Page title={t.title.supplier_orders()} view="orders/suppliers/orders" {db} {plugins}>
	<div slot="main" class="flex h-full flex-col gap-y-2 divide-y">
		<div
			class="flex flex-row justify-between gap-x-2 overflow-x-auto
   p-4"
		>
			<div
				class="flex gap-2 px-2"
				role="group"
				aria-label="Filter
   orders by status"
			>
				<a
					href={appHash("unordered")}
					class="btn-sm btn {$page.route.id === '/orders/suppliers/orders' ? 'btn-primary' : 'btn-outline'}"
					aria-current={$page.route.id === "/orders/suppliers/orders" ? "page" : undefined}
				>
					{t.tabs.unordered()}
				</a>

				<a
					href={appHash("ordered")}
					class="btn-sm btn {$page.route.id === '/orders/suppliers/orders/ordered' ? 'btn-primary' : 'btn-outline'}"
					aria-current={$page.route.id === "/orders/suppliers/orders/ordered" ? "page" : undefined}
					class:btn-disabled={!hasPlacedOrders}
					data-testid="ordered-list"
				>
					{t.tabs.ordered()}
				</a>

				<a
					href={appHash("reconciling")}
					class="btn-sm btn {$page.route.id === '/orders/suppliers/orders/reconciling' ? 'btn-primary' : 'btn-outline'}"
					aria-current={$page.route.id === "/orders/suppliers/orders/reconciling" ? "page" : undefined}
					class:btn-disabled={!hasReconcilingOrders}
					data-testid="reconciling-list"
				>
					{t.tabs.reconciling()}
				</a>
				<div class="w-fit">
					<a
						href={appHash("completed")}
						class="btn-sm btn self-end {$page.route.id === '/orders/suppliers/orders/completed' ? 'btn-primary' : 'btn-outline'}"
						aria-current={$page.route.id === "/orders/suppliers/orders/completed" ? "page" : undefined}
						class:btn-disabled={!hasCompletedOrders}
						data-testid="completed-list"
					>
						{t.tabs.completed()}
					</a>
				</div>
			</div>

			<button class="btn-outline btn-sm btn gap-2" on:click={() => goto(appHash("suppliers"))}>
				{t.labels.suppliers()}
				<Settings size={20} />
			</button>
		</div>

		<div class="h-full w-full p-4">
			<slot />
		</div>
	</div>
</Page>

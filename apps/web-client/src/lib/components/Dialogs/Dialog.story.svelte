<script lang="ts">
	import { createDialog } from "@melt-ui/svelte";
	import Dialog from "./Dialog.svelte";

	import type { Hst } from "@histoire/plugin-svelte";

	const dialog = createDialog({
		forceVisible: true
	});

	export let Hst: Hst;
</script>

<Hst.Story title="Dialogs" layout={{ type: "grid", width: 600 }}>
	<Hst.Variant title="Default - Commit">
		<Dialog {dialog} type="commit">
			<svelte:fragment slot="title">Commit inbound note-9?</svelte:fragment>
			<svelte:fragment slot="description">15 books will be added to Warehouse-1</svelte:fragment>
		</Dialog>
	</Hst.Variant>
	<Hst.Variant title="Default - Delete">
		<Dialog {dialog} type="delete">
			<svelte:fragment slot="title">Permanently delete warehouse 1?</svelte:fragment>
			<svelte:fragment slot="description">Once you delete this warehouse, 380 books will be removed from your stock</svelte:fragment>
		</Dialog>
	</Hst.Variant>
	<Hst.Variant title="Order - Commit">
		<Dialog {dialog} type="commit">
			<svelte:fragment slot="title">Create a new order for Martin Freeman?</svelte:fragment>
			<svelte:fragment slot="description"
				>This includes <span class="font-bold">3 books</span> and totals <span class="font-bold">$66</span>.</svelte:fragment
			>
		</Dialog>
	</Hst.Variant>
</Hst.Story>

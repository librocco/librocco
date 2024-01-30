<script lang="ts">
	import { createDialog } from "@melt-ui/svelte";
	import Dialog from "./Dialog.svelte";

	import type { Hst } from "@histoire/plugin-svelte";

	const dialog = createDialog({
		forceVisible: true
	});

	export let Hst: Hst;
</script>

<Hst.Story title="Dialogs / Default" layout={{ type: "grid", width: 600 }}>
	<Hst.Variant title="Active">
		<Dialog {dialog} type="commit">
			<svelte:fragment slot="title">Commit inbound note-9?</svelte:fragment>
			<svelte:fragment slot="description">15 books will be added to Warehouse-1</svelte:fragment>
		</Dialog>
	</Hst.Variant>
</Hst.Story>

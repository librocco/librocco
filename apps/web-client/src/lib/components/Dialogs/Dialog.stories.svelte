<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import Dialog from "./Dialog.svelte";

	export const meta: Meta = {
		title: "Dialogs",
		component: Dialog
	};
</script>

<script lang="ts">
	import { Story, Template } from "@storybook/addon-svelte-csf";
	import { createDialog } from "@melt-ui/svelte";

	const dialog = createDialog({
		forceVisible: true
	});
</script>

<Template let:args={{ type, title, description }}>
	<Dialog {dialog} {type}>
		<svelte:fragment slot="title">{title}</svelte:fragment>
		<svelte:fragment slot="description">{@html description}</svelte:fragment>
	</Dialog>
</Template>

<Story
	name="Default - Commit"
	args={{ type: "commit", title: "Commit inboud note-9?", description: "15 books will be added to Warehouse-1" }}
/>

<Story
	name="Default - Delete"
	args={{
		type: "delete",
		title: "Permanently delete warehouse 1?",
		description: "Once you delete this warehouse, 380 books will be removed from your stock"
	}}
/>

<Story
	name="Order - Commit"
	args={{
		type: "commit",
		title: "Create a new order for Martin Freeman?",
		description: `This includes <span class="font-bold">3 books</span> and totals <span class="font-bold">$66</span>.`
	}}
/>

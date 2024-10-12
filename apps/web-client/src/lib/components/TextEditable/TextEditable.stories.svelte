<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import TextEditable from "./TextEditable.svelte";

	export const meta: Meta = {
		title: "Editable Text",
		component: TextEditable
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";
</script>

<Story name="Interactive - default">
	<TextEditable name="interactive" />
</Story>

<Story name="Interactive - styled h2">
	<TextEditable value="Vendita (2)" name="interactive-styled" textEl="h1" textClassName="text-xl font-medium sm:text-2xl" />
</Story>

<Story name="Disabled - default">
	<TextEditable value="Vendita (3)" name="disabled" disabled />
</Story>

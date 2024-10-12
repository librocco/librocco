<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import Checkbox from "../Checkbox.svelte";

	export const meta: Meta = {
		title: "Forms / Checkbox",
		component: Checkbox
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";
</script>

<Story name="Default">
	<Checkbox id="1" name="default" label="Select an option?" helpText="Unchecked & focussable" />
</Story>

<Story name="Checked">
	<Checkbox id="2" name="checked" label="Select an option?" helpText="Checked" checked={true} />
</Story>

<Story name="Disabled">
	<Checkbox id="3" name="disabled" label="Select an option?" helpText="Checked & disabeld" disabled={true} checked={true} />
</Story>

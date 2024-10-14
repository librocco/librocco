<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import Input from "../Input.svelte";

	export const meta: Meta = {
		title: "Forms / Input",
		component: Input
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";
	import { Mail } from "lucide-svelte";
</script>

<Story name="Default">
	<Input name="default-placeholder" label="Default with placeholder" placeholder="placeholder">
		<p slot="helpText">And some help text</p>
	</Input>
</Story>

<Story name="Start Adornment">
	<Input name="start-adornment" placeholder="placeholderemail@gmail.com" label="Start Adornment">
		<span slot="start-adornment">
			<Mail />
		</span>
	</Input>
</Story>

<Story name="Start & End Adonrnments">
	<Input name="start-end-adornment" placeholder="placeholderemail@gmail.com" label="Start & End Adornments">
		<span slot="start-adornment">$</span>
		<span slot="end-adornment">USD</span>
	</Input>
</Story>

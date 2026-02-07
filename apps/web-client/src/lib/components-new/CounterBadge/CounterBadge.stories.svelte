<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import CounterBadge from "./CounterBadge.svelte";

	export const meta: Meta = {
		title: "Counter Badge",
		component: CounterBadge
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";
</script>

<Story name="Reconciliation Order - step 1">
	<div class="flex gap-4">
		<CounterBadge label="Total Ordered" value={14} />
		<CounterBadge label="Total Delivered" value={0} />
	</div>
</Story>

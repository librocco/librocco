<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import { HeadCol, BodyMultiRow } from "../Cells";

	export const meta: Meta = {
		title: "Tables / Cells",
		subcomponents: {
			HeadCol,
			BodyMultiRow
		}
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	import { UserRound } from "lucide-svelte";
</script>

<Story name="Head Column Cell">
	<HeadCol label="Customer" icon={UserRound} />
</Story>

<Story name="Body Multi-row Cell">
	<BodyMultiRow
		rows={{
			name: { data: "Christopher De Sousa", className: "text-md font-medium" },
			email: { data: "chris@cool.com", className: "text-md font-light" }
		}}
	/>
</Story>

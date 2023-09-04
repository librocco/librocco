<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import DiscountInput from "./DiscountInput.svelte";

	export let Hst: Hst;
</script>

<Hst.Story title="Forms / DiscountInput" layout={{ type: "grid", width: 600 }}>
	<div class="py-2 px-8">
		<DiscountInput label="Warehouse discount:" />
	</div>
</Hst.Story>

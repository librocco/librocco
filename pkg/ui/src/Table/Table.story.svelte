<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { TableHeadless, Table } from './index';
	export let Hst: Hst;
</script>

<Hst.Story title="Table">
	<Hst.Variant title="Headless">
		<TableHeadless />
	</Hst.Variant>
	<Hst.Variant title="Non-Headless">
		<Table />
	</Hst.Variant>
</Hst.Story>

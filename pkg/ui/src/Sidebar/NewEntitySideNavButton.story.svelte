<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import SideNavButton from './NewEntitySideNavButton.svelte';

	export let Hst: Hst;
</script>

<Hst.Story title="Sidebar Navigation / New Entity" layout={{ type: 'grid', width: 300 }}>
	<Hst.Variant title="Inactive">
		<SideNavButton active={false} />
	</Hst.Variant>
	<Hst.Variant title="Active">
		<SideNavButton />
	</Hst.Variant>
	<Hst.Variant title="Warehouse">
		<SideNavButton label="New Warehouse" />
	</Hst.Variant>
</Hst.Story>

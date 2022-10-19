<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { Mail } from 'lucide-svelte';

	import SidebarNav from './SidebarNav.svelte';
	import SidebarItem from './SidebarItem.svelte';
	import SidebarItemGroup from './SidebarItemGroup.svelte';

	export let Hst: Hst;

	const voidLink = 'javascript:void(0)';

	const items = [
		{
			name: 'All',
			href: voidLink,
			current: true
		},
		{
			name: 'Scolastica 2021',
			href: voidLink,
			current: false
		},
		{
			name: 'Varia 2018',
			href: voidLink,
			current: false
		}
	];

	const folders = [
		{
			name: 'Warehouse 1',
			expanded: true,
			items
		},
		{
			name: 'Warehouse 2',
			expanded: false,
			items
		}
	];
</script>

<Hst.Story title="Sidebar Navigation / Prototype" layout={{ type: 'grid', width: 400 }}>
	<Hst.Variant title="Warehouses">
		<SidebarNav>
			{#each items as item}
				<SidebarItem {...item} />
			{/each}
		</SidebarNav>
	</Hst.Variant>
	<Hst.Variant title="In Notes">
		<SidebarNav>
			{#each folders as folder, index}
				<SidebarItemGroup {...folder} {index} />
			{/each}
		</SidebarNav>
	</Hst.Variant>
</Hst.Story>

<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { Mail } from 'lucide-svelte';

	import SidebarNav from '../SidebarNav.svelte';
	import SidebarItem from '../SidebarItem.svelte';
	import SidebarItemGroup from '../SidebarItemGroup.svelte';

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

<Hst.Story title="Sidebar Navigation / Items" layout={{ type: 'grid', width: 400 }}>
	<Hst.Variant title="Item: Default">
		<div class="space-y-2">
			<SidebarItem name="Warehouse 1" href={voidLink} />
			<SidebarItem name="Warehouse 1" href={voidLink} current />
		</div>
	</Hst.Variant>
	<Hst.Variant title="Item: With Icon">
		<div class="space-y-2">
			<SidebarItem name="Warehouse 1" href={voidLink}>
				<Mail />
			</SidebarItem>
			<SidebarItem name="Warehouse 1" href={voidLink} current>
				<Mail />
			</SidebarItem>
		</div>
	</Hst.Variant>
	<Hst.Variant title="Item: Nested">
		<div class="space-y-2">
			<SidebarItem name="Warehouse 1" href={voidLink} nested />
			<SidebarItem name="Warehouse 1" href={voidLink} nested current />
		</div>
	</Hst.Variant>
	<Hst.Variant title="Item Group">
		<div class="space-y-2">
			<SidebarItemGroup name="Warehouse 1" {items} expanded={false} index={1} />
			<SidebarItemGroup name="Warehouse 1" {items} expanded index={2} />
		</div>
	</Hst.Variant>
</Hst.Story>

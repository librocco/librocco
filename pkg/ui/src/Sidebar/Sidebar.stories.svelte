<script lang="ts">
	import { Story, Meta } from '@storybook/addon-svelte-csf';

	import { Mail } from '@librocco/svg';

	import SidebarNav from './SidebarNav.svelte';
	import SidebarItem from './SidebarItem.svelte';
	import SidebarItemGroup from './SidebarItemGroup.svelte';

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

<Meta title="Sidebar Navigation" />
<Story name="Prototype">
	<div class="w-52 space-y-4">
		<div class="space-y-2">
			<h1 class="text-md bold">Warehouses</h1>
			<SidebarNav>
				{#each items as item}
					<SidebarItem {...item} />
				{/each}
			</SidebarNav>
		</div>
		<div class="space-y-2">
			<h1 class="text-md bold">In Notes</h1>
			<SidebarNav>
				{#each folders as folder, index}
					<SidebarItemGroup {...folder} {index} />
				{/each}
			</SidebarNav>
		</div>
	</div>
</Story>

<Story name="Folder">
	<div class="w-52 space-y-4">
		<div class="space-y-2">
			<h1 class="text-md bold">Default:</h1>
			<SidebarItemGroup name="Warehouse 1" {items} expanded={false} index={1} />
			<SidebarItemGroup name="Warehouse 1" {items} expanded index={2} />
		</div>
	</div>
</Story>

<Story name="Item">
	<div class="w-52 space-y-4">
		<div class="space-y-2">
			<h1 class="text-md bold">Default:</h1>
			<SidebarItem name="Warehouse 1" href={voidLink} />
			<SidebarItem name="Warehouse 1" href={voidLink} current />
		</div>
		<div class="space-y-2">
			<h1 class="text-md bold">With Icon:</h1>
			<SidebarItem name="Warehouse 1" href={voidLink}>
				<Mail />
			</SidebarItem>
			<SidebarItem name="Warehouse 1" href={voidLink} current>
				<Mail />
			</SidebarItem>
		</div>
		<div class="space-y-2">
			<h1 class="text-md bold">Nested:</h1>
			<SidebarItem name="Warehouse 1" href={voidLink} nested />
			<SidebarItem name="Warehouse 1" href={voidLink} nested current />
		</div>
	</div>
</Story>

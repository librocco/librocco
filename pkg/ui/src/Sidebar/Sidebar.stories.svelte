<script lang="ts">
	import { Story, Meta } from '@storybook/addon-svelte-csf';

	import { Mail } from '@librocco/svg';

	import SidebarItem from './SidebarItem.svelte';
	import SidebarFolder from './SidebarFolder.svelte';

	const voidLink = 'javascript:void(0)';

	const items = [
		{
			name: 'Overview',
			href: voidLink,
			current: true
		},
		{
			name: ' Members',
			href: voidLink,
			current: false
		}
	];
</script>

<Meta
	title="Sidebar Navigation"
	argTypes={{
		class: { control: 'string' },
		selected: { control: 'boolean' }
	}}
/>

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

<Story name="Folder">
	<div class="w-52 space-y-4">
		<div class="space-y-2">
			<h1 class="text-md bold">Default:</h1>
			<SidebarFolder name="Team" {items} expanded={false} index={1} />
			<SidebarFolder name="Team" {items} expanded index={2} />
		</div>
	</div>
</Story>

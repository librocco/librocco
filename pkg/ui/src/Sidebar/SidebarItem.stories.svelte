<script lang="ts">
	import { Story, Meta } from '@storybook/addon-svelte-csf';

	import { Mail } from '@librocco/svg';

	import SidebarItem from './SidebarItem.svelte';

	const voidLink = 'javascript:void(0)';
</script>

<Meta
	title="Sidebar Navigation Item"
	argTypes={{
		class: { control: 'string' },
		selected: { control: 'boolean' }
	}}
/>

<Story name="Default">
	<div class="w-52 space-y-4">
		<div>
			<h1 class="text-md bold block mb-2">Default:</h1>
			<SidebarItem name="Warehouse 1" href={voidLink} />
			<SidebarItem name="Warehouse 1" href={voidLink} current />
		</div>
		<div>
			<h1 class="text-md bold block mb-2">With Icon:</h1>
			<SidebarItem name="Warehouse 1" href={voidLink}>
				<Mail />
			</SidebarItem>
			<SidebarItem name="Warehouse 1" href={voidLink} current>
				<Mail />
			</SidebarItem>
		</div>
		<div>
			<h1 class="text-md bold block mb-2">Nested:</h1>
			<SidebarItem name="Warehouse 1" href={voidLink} nested />
			<SidebarItem name="Warehouse 1" href={voidLink} nested current />
		</div>
	</div>
</Story>

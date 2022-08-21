<script lang="ts">
	import { Story, Meta } from '@storybook/addon-svelte-csf';

	import { Mail } from '@librocco/svg';

	import SideNavButton from './SideNavButton.svelte';
</script>

<Meta
	title="Side Navigation: Button"
	argTypes={{
		class: { control: 'string' },
		selected: { control: 'boolean' }
	}}
/>

<Story name="Variants">
	<div class="bg-gray-700 w-20 flex items-center flex-col py-2">
		<h1 class="text-md text-white bold block mb-2">Inactive:</h1>
		<SideNavButton class="block mb-4">
			<Mail />
		</SideNavButton>
		<h1 class="text-md text-white bold block mb-2">Selected:</h1>
		<SideNavButton selected>
			<Mail />
		</SideNavButton>
	</div>
</Story>

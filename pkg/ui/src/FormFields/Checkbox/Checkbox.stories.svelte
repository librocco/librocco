<script lang="ts">
	import { Story, Meta } from '@storybook/addon-svelte-csf';

	import Checkbox from './Checkbox.svelte';
</script>

<Meta title="Form Fields / Checkbox" />

<Story name="Default">
	<div class="flex flex-col w-72 space-y-5">
		<Checkbox name="default" label="Select an option?" helpText="Unchecked & focussable" />
		<Checkbox name="checked" label="Select an option?" helpText="Checked" checked={true} />
		<Checkbox
			name="disabled"
			label="Select an option?"
			helpText="Checked & disabeld"
			disabled={true}
			checked={true}
		/>
	</div>
</Story>

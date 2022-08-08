<script lang="ts">
	import { Meta, Story, Template } from '@storybook/addon-svelte-csf';

	import Button from './Button.svelte';
</script>

<Meta
	title="Components/Button"
	argTypes={{
		label: { control: 'string' }
	}}
/>

<Template let:args={{ label }}>
	<Button {label} />
</Template>

<Story name="Default" args={{ label: 'Click me' }} />

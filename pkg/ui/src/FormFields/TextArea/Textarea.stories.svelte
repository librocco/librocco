<script lang="ts">
	import { Story, Meta } from '@storybook/addon-svelte-csf';

	import Textarea from './Textarea.svelte';
</script>

<Meta title="Form Fields / Textarea" />

<Story name="Default">
	<Textarea label="Default" helpText="Insert your input" />
</Story>

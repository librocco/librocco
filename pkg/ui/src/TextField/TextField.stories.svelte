<script lang="ts">
	import { Story, Meta } from '@storybook/addon-svelte-csf';

	import TextField from './TextField.svelte';
</script>

<Meta title="Text Field component" />

<Story name="Default">
	<TextField label="Default" class="w-1/2" />
</Story>
<Story name="Start Adornment">
	<TextField label="Start Adronment Input" startAdornment="start" class="w-1/2" />
</Story>
<Story name="End Adornment">
	<TextField label="End Adronment Input" endAdornment="end" class="w-1/2" />
</Story>

<script lang="ts">
	import { Mail } from '@librocco/svg';
	import { Story, Meta } from '@storybook/addon-svelte-csf';

	import TextField from './TextField.svelte';
</script>

<Meta title="Form Fields / Text Field" />

<Story name="Default">
	<TextField label="Default" helpText="Insert your input" />
</Story>
<Story name="Default with placeholder">
	<TextField label="Default with placeholder" placeholder="placeholder" />
</Story>
<Story name="Start Adornment, with the mail icon and email placeholder">
	<TextField
		placeholder="placeholderemail@gmail.com"
		label="Start Adornment, with the mail icon and email placeholder"
	>
		<div slot="startAdornment">
			<div class="w-5 h-5">
				<Mail />
			</div>
		</div>
	</TextField>
</Story>
<Story name="Start & End, with the dollar sign and USD">
	<TextField
		placeholder="placeholderemail@gmail.com"
		label="Start & End, with the dollar sign and USD"
	>
		<div slot="startAdornment">$</div>
		<div slot="endAdornment">USD</div>
	</TextField>
</Story>

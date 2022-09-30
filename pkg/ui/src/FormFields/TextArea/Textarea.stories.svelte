<script lang="ts">
	import { Story, Meta } from '@storybook/addon-svelte-csf';

	import Textarea, { Resize } from './';
</script>

<Meta title="Form Fields / Textarea" />

<Story name="Default">
	<div class="space-y-8">
		<Textarea
			name="default"
			label="Default"
			helpText="Here is some help text"
			placeholder="This is a placeholder"
		/>
		<Textarea
			name="resizable"
			label="Resizable"
			placeholder="You can resize me in any direction"
			resize={Resize.Both}
		/>
		<Textarea name="maxlength" label="Max Length" placeholder="I have a max char length of 20" />
	</div>
</Story>

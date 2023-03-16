<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import Textarea from './';
	import { TextAreaResize } from '../enums';

	export let Hst: Hst;
</script>

<Hst.Story title="Form Fields / Textarea" layout={{ type: 'grid', width: 500 }}>
	<Hst.Variant title="Default">
		<Textarea
			name="default"
			label="Default"
			helpText="Here is some help text"
			placeholder="This is a placeholder"
		/>
	</Hst.Variant>
	<Hst.Variant title="Resizable">
		<Textarea
			name="resizable"
			label="Resizable"
			placeholder="You can resize me in any direction"
			resize={TextAreaResize.Both}
		/>
	</Hst.Variant>
	<Hst.Variant title="Max Length">
		<Textarea name="maxlength" label="Max Length" placeholder="I have a max char length of 20" maxlength={20} />
	</Hst.Variant>
</Hst.Story>

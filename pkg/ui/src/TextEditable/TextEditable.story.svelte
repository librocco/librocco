<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import TextEditable from './TextEditable.svelte';

	export let Hst: Hst;

	let text = 'Warehouse';
</script>

<Hst.Story title="Text Editable" layout={{ type: 'grid', width: 500 }}>
	<Hst.Variant title="Interactive">
		<pre>{text}</pre>
		<TextEditable bind:value={text} />
	</Hst.Variant>

	<Hst.Variant title="Disabled">
		<TextEditable bind:value={text} disabled />
	</Hst.Variant>
</Hst.Story>

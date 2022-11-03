<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { Mail } from 'lucide-svelte';

	import TextField from './TextField.svelte';

	export let Hst: Hst;
</script>

<Hst.Story title="Form Fields / TextField" layout={{ type: 'grid', width: 300 }}>
	<Hst.Variant title="Default">
		<TextField name="default-placeholder" label="Default with placeholder" placeholder="placeholder" />
	</Hst.Variant>
	<Hst.Variant title="Start Adornment">
		<TextField name="start-adornment" placeholder="placeholderemail@gmail.com" label="Start Adornment">
			<span slot="startAdornment">
				<Mail />
			</span>
		</TextField>
	</Hst.Variant>
	<Hst.Variant title="Start & End Adornments">
		<TextField name="start-end-adornment" placeholder="placeholderemail@gmail.com" label="Start & End Adornments">
			<span slot="startAdornment">$</span>
			<span slot="endAdornment">USD</span>
		</TextField>
	</Hst.Variant>
</Hst.Story>

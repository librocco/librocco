<script lang="ts">
import type { Hst } from '@histoire/plugin-svelte';

	import { Mail, Search, Edit, QrCode } from 'lucide-svelte';

	import { Button, ButtonSize } from '../../Button';
	import { TextFieldSize } from '../enums';

	import TextField from './TextField.svelte';

	export let Hst: Hst;
</script>

<Hst.Story title="Form Fields / TextField" layout={{ type: 'grid', width: 700 }}>
	<Hst.Variant title="Default">
		<TextField name="default-placeholder" label="Default with placeholder" placeholder="placeholder" helpText="And some help text"/>
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
	<Hst.Variant title="Prototype: Scan input ">
		<TextField name="scan-input" placeholder="Scan to add books..." variant={TextFieldSize.LG}>
			<span slot="startAdornment">
				<QrCode />
			</span>
			<div slot="endAdornment" class="flex gap-x-2">
				<Button size={ButtonSize.SM}>
					<span slot="startAdornment">
						<Search size={16}/>
					</span>
					Search
				</Button>
				<Button size={ButtonSize.SM}>
					<span slot="startAdornment">
						<Edit  size={16}/>
					</span>
					Create
				</Button>
			</div>
		</TextField>
	</Hst.Variant>
</Hst.Story>

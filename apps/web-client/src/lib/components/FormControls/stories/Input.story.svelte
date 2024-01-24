<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import { Mail } from "lucide-svelte";

	import Input from "../Input.svelte";

	export let Hst: Hst;
</script>

<Hst.Story title="Form Controls / Input" layout={{ type: "grid", width: 700 }}>
	<Hst.Variant title="Default">
		<Input name="default-placeholder" label="Default with placeholder" placeholder="placeholder">
			<p slot="helpText">And some help text</p>
		</Input>
	</Hst.Variant>
	<Hst.Variant title="Start Adornment">
		<Input name="start-adornment" placeholder="placeholderemail@gmail.com" label="Start Adornment">
			<span slot="startAdornment">
				<Mail />
			</span>
		</Input>
	</Hst.Variant>
	<Hst.Variant title="Start & End Adornments">
		<Input name="start-end-adornment" placeholder="placeholderemail@gmail.com" label="Start & End Adornments">
			<span slot="startAdornment">$</span>
			<span slot="endAdornment">USD</span>
		</Input>
	</Hst.Variant>
</Hst.Story>

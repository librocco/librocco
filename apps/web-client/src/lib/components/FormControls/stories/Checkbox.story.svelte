<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import Checkbox from "../Checkbox.svelte";

	export let Hst: Hst;
</script>

<Hst.Story title="Form Controls / Checkbox" layout={{ type: "grid" }}>
	<Hst.Variant title="Default">
		<Checkbox id="1" name="default" label="Select an option?" helpText="Unchecked & focussable" />
	</Hst.Variant>
	<Hst.Variant title="Checked">
		<Checkbox id="2" name="checked" label="Select an option?" helpText="Checked" checked={true} />
	</Hst.Variant>
	<Hst.Variant title="Disabled">
		<Checkbox id="3" name="disabled" label="Select an option?" helpText="Checked & disabeld" disabled={true} checked={true} />
	</Hst.Variant>
</Hst.Story>

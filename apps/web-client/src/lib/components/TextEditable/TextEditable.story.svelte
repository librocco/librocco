<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import TextEditable from "./TextEditable.svelte";

	export let Hst: Hst;
</script>

<Hst.Story title="Text Editable" layout={{ type: "grid", width: 500 }}>
	<Hst.Variant title="Interactive - default">
		<TextEditable name="interactive" />
	</Hst.Variant>

	<Hst.Variant title="Interactive - styled h1">
		<TextEditable value="Vendita (2)" name="interactive-styled" textEl="h1" textClassName="text-xl font-medium sm:text-2xl" />
	</Hst.Variant>

	<Hst.Variant title="Disabled - default">
		<TextEditable value="Vendita (3)" name="disabled" disabled />
	</Hst.Variant>
</Hst.Story>

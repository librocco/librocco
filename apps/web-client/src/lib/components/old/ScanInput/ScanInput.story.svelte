<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import ScanField from "./ScanInput.svelte";

	export let Hst: Hst;
</script>

<Hst.Story title="Forms / ScanInput" layout={{ type: "grid", width: 600 }}>
	<ScanField />
</Hst.Story>

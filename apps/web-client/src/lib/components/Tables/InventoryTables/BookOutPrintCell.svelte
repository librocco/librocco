<script lang="ts">
	import { Checkbox } from "$lib/components";

	export let rowIx: number;
	export let outOfPrint: boolean;
</script>

<Checkbox id="outOfPrint-{rowIx}" name="Row ${rowIx} is out of print: ${outOfPrint}" checked={outOfPrint} disabled />

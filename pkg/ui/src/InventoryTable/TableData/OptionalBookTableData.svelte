<script lang="ts">
	import { Checkbox } from '../../';

	import type { BookOptionalRowData } from '../types';

	export let data: BookOptionalRowData;
	export let rowIx: number;

	$: ({ publisher, editedBy, outOfPrint } = data);
</script>

<td class="hidden py-4 px-3 md:table-cell">
	{publisher}
</td>
<td class="hidden py-4 px-3 xl:table-cell">
	{editedBy}
</td>
<td class="hidden py-4 px-3 text-center xl:table-cell">
	<span class="inline-block">
		<Checkbox name={`Row ${rowIx} is out of print: ${outOfPrint}`} checked={outOfPrint} disabled />
	</span>
</td>

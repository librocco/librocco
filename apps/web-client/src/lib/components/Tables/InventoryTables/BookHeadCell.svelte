<script lang="ts">
	import BodyMultiRow from "../Cells/BodyMultiRow.svelte";
	import type { InventoryTableData } from "../types";

	export let data: Pick<InventoryTableData, "isbn" | "title" | "authors" | "year">;

	$: ({ isbn, title, authors, year } = data);
</script>

<div class="max-w-sm">
	<span class="text-gray-800">{isbn}</span>
	<BodyMultiRow
		dlClassName="flex flex-col gap-y-0.5 mt-1 font-light text-gray-500 lg:hidden"
		rows={{
			name: { data: title },
			authors: { data: authors },
			year: { data: year }
		}}
	/>
</div>

<script lang="ts">
	import BodyMultiRow from "../Cells/BodyMultiRow.svelte";
	import type { InventoryTableData } from "../types";

	export let data: Pick<InventoryTableData<"book">, "isbn" | "title" | "authors" | "year">;

	$: ({ isbn, title, authors, year } = data);
</script>

<div>
	<span data-property="isbn">{isbn}</span>
	<BodyMultiRow
		dlClassName="flex flex-col gap-y-0.5 mt-1 font-light  lg:hidden"
		rows={{
			title: { data: title },
			authors: { data: authors },
			year: { data: year }
		}}
	/>
</div>

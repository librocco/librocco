<script lang="ts">
	export let columnWidths: Array<string | { value: number; unit?: "%" | "px" | "rem" }> = [];

	$: columnCount = columnWidths.length;
</script>

<div class="overflow-hidden rounded border border-[#E5E5E5]">
	<table class="w-full table-fixed">
		{#if columnWidths && columnWidths.length > 0}
			<colgroup>
				{#each columnWidths as width}
					{#if typeof width === "string"}
						<col style="width: calc({width} / 12 * 100%);" />
					{:else if typeof width === "object"}
						<col style="width: {width.value}{width.unit ?? 'px'};" />
					{:else}
						<col />
					{/if}
				{/each}
			</colgroup>
		{/if}

		<thead>
			<tr class="border-b border-[#E5E5E5] bg-[#FAFAFA] px-4">
				<slot name="head-cells" />
			</tr>
		</thead>

		<tbody>
			<slot name="rows" />
		</tbody>
	</table>
</div>

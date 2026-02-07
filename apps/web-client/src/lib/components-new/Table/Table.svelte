<script lang="ts">
	export let variant: "default" | "naked" = "default";
	export let columnWidths: Array<string | { value: number; unit?: "%" | "px" | "rem" }> = [];
	export let showEmptyState: boolean = false;
</script>

<div class="overflow-hidden {variant === 'default' ? 'rounded border border-[#E5E5E5]' : ''}">
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
			<tr class="{variant === 'default' ? 'border-b border-[#E5E5E5] bg-[#FAFAFA]' : ''} px-4">
				<slot name="head-cells" />
			</tr>
		</thead>

		<tbody>
			{#if showEmptyState}
				<tr>
					<td colspan={columnWidths.length || 1} class="text-muted-foreground px-4 py-2 text-center text-sm">
						<slot name="empty">Nothing to see here</slot>
					</td>
				</tr>
			{:else}
				<slot name="rows" />
			{/if}
		</tbody>
	</table>
</div>

<script lang="ts">
	import type { Writable } from "svelte/store";
	import { ChevronDown, ChevronUp } from "lucide-svelte";

	import type { BookData } from "@librocco/shared";

	import { type createTable } from "$lib/actions";

	import { HeadCol } from "../Cells";

	import BooksTableRow from "./BooksTableRow.svelte";

	export let table: ReturnType<typeof createTable<Required<BookData>>>;
	export let orderBy: Writable<keyof BookData>;
	export let orderAsc: Writable<boolean>;

	const { table: tableAction } = table;
	$: ({ rows } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;

	const handleOrderBy = (property: keyof BookData) => () => {
		if ($orderBy === property) {
			$orderAsc = !$orderAsc;
		} else {
			$orderBy = property;
			$orderAsc = true;
		}
	};
</script>

<table id="inventory-table" class="stock-table" use:tableAction={{ rowCount }}>
	<thead>
		<tr>
			<th
				on:click={handleOrderBy("isbn")}
				scope="col"
				class="group relative cursor-pointer {$orderBy === 'isbn'
					? 'bg-cyan-700/30'
					: 'hover:bg-cyan-500/10'} w-[20%] lg:w-[13%] xl:w-[10%]"
			>
				<span class="hidden lg:inline">ISBN</span>
				<span class="inline lg:hidden">Book</span>
				<span id="ord" class="{$orderBy === 'isbn' ? '' : 'hidden group-hover:block'} absolute right-2 top-1/2 -translate-y-1/2">
					{#if $orderBy === "isbn" && !$orderAsc}
						<ChevronUp class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{:else}
						<ChevronDown class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{/if}
				</span>
			</th>

			<th
				on:click={handleOrderBy("title")}
				scope="col"
				class="group relative cursor-pointer {$orderBy === 'title' ? 'bg-cyan-700/30' : 'hover:bg-cyan-500/10'} show-col-lg"
			>
				<span>Title</span>
				<span id="ord" class="{$orderBy === 'title' ? '' : 'hidden group-hover:block'} absolute right-2 top-1/2 -translate-y-1/2">
					{#if $orderBy === "title" && !$orderAsc}
						<ChevronUp class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{:else}
						<ChevronDown class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{/if}
				</span>
			</th>

			<th
				on:click={handleOrderBy("authors")}
				scope="col"
				class="group relative cursor-pointer {$orderBy === 'authors' ? 'bg-cyan-700/30' : 'hover:bg-cyan-500/10'} show-col-lg"
			>
				<span>Authors</span>
				<span id="ord" class="{$orderBy === 'authors' ? '' : 'hidden group-hover:block'} absolute right-2 top-1/2 -translate-y-1/2">
					{#if $orderBy === "authors" && !$orderAsc}
						<ChevronUp class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{:else}
						<ChevronDown class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{/if}
				</span>
			</th>

			<th
				on:click={handleOrderBy("price")}
				scope="col"
				class="group relative cursor-pointer {$orderBy === 'price' ? 'bg-cyan-700/30' : 'hover:bg-cyan-500/10'} "
			>
				<span>Price</span>
				<span id="ord" class="{$orderBy === 'price' ? '' : 'hidden group-hover:block'} absolute right-2 top-1/2 -translate-y-1/2">
					{#if $orderBy === "price" && !$orderAsc}
						<ChevronUp class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{:else}
						<ChevronDown class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{/if}
				</span>
			</th>

			<th
				on:click={handleOrderBy("publisher")}
				scope="col"
				class="group relative cursor-pointer {$orderBy === 'publisher' ? 'bg-cyan-700/30' : 'hover:bg-cyan-500/10'} "
			>
				<span>Publisher</span>
				<span id="ord" class="{$orderBy === 'publisher' ? '' : 'hidden group-hover:block'} absolute right-2 top-1/2 -translate-y-1/2">
					{#if $orderBy === "publisher" && !$orderAsc}
						<ChevronUp class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{:else}
						<ChevronDown class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{/if}
				</span>
			</th>

			<th
				on:click={handleOrderBy("year")}
				scope="col"
				class="group relative cursor-pointer {$orderBy === 'year' ? 'bg-cyan-700/30' : 'hover:bg-cyan-500/10'} show-col-lg"
			>
				<span>Year</span>
				<span id="ord" class="{$orderBy === 'year' ? '' : 'hidden group-hover:block'} absolute right-2 top-1/2 -translate-y-1/2">
					{#if $orderBy === "year" && !$orderAsc}
						<ChevronUp class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{:else}
						<ChevronDown class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{/if}
				</span>
			</th>

			<th
				on:click={handleOrderBy("editedBy")}
				scope="col"
				class="group relative cursor-pointer {$orderBy === 'editedBy' ? 'bg-cyan-700/30' : 'hover:bg-cyan-500/10'} show-col-xl"
			>
				<span>Edited By</span>
				<span id="ord" class="{$orderBy === 'editedBy' ? '' : 'hidden group-hover:block'} absolute right-2 top-1/2 -translate-y-1/2">
					{#if $orderBy === "editedBy" && !$orderAsc}<ChevronUp class="h-4 w-4 rounded border border-gray-900 bg-white" />
						<ChevronUp class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{:else}
						<ChevronDown class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{/if}
				</span>
			</th>

			<th
				on:click={handleOrderBy("outOfPrint")}
				scope="col"
				class="group relative cursor-pointer {$orderBy === 'outOfPrint' ? 'bg-cyan-700/30' : 'hover:bg-cyan-500/10'} show-col-xl"
			>
				<span>O.P</span>
				<span id="ord" class="{$orderBy === 'outOfPrint' ? '' : 'hidden group-hover:block'} absolute right-2 top-1/2 -translate-y-1/2"
				></span>
			</th>

			<th
				on:click={handleOrderBy("category")}
				scope="col"
				class="group relative cursor-pointer {$orderBy === 'category' ? 'bg-cyan-700/30' : 'hover:bg-cyan-500/10'} show-col-xl"
			>
				<span>Category</span>
				<span id="ord" class="{$orderBy === 'category' ? '' : 'hidden group-hover:block'} absolute right-2 top-1/2 -translate-y-1/2">
					{#if $orderBy === "category" && !$orderAsc}
						<ChevronUp class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{:else}
						<ChevronDown class="h-4 w-4 rounded border border-gray-900 bg-white" />
					{/if}
				</span>
			</th>

			{#if $$slots["row-actions"]}
				<th scope="col" class="table-cell-fit relative cursor-pointer"> <HeadCol label="Row Actions" srOnly /> </th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.key)}
			{@const { rowIx, key, ...rowData } = row}

			<slot name="row" row={rowData} {rowIx}>
				<tr use:table.tableRow={{ position: rowIx }}>
					<BooksTableRow row={rowData} {rowIx} />
				</tr>
			</slot>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>

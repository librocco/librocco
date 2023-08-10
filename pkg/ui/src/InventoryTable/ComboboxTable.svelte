<script lang="ts">
	import Transition from "svelte-transition";
	import type { createCombobox } from "svelte-headlessui";

	import { Badge, BadgeColor, BadgeSize } from "../Badge";

	import type { BookCoreRowData } from "./types";
	import { thRowBaseStyles } from "./utils";

	export let combobox: ReturnType<typeof createCombobox>;
	export let rows: BookCoreRowData[];
</script>

<Transition
	show={$combobox.expanded}
	leave="transition ease-in duration-100"
	leaveFrom="opacity-100"
	leaveTo="opacity-0"
	on:after-leave={() => combobox.reset()}
>
	<div class="absolute z-10 mt-1 max-h-[30rem] w-full overflow-y-scroll rounded-md shadow-md">
		<table class="w-full bg-white py-1 text-base">
			<thead class="sticky top-0 z-[20] bg-white">
				<tr class="whitespace-nowrap">
					<th scope="col" class={thRowBaseStyles}>book</th>
					<th scope="col" class={thRowBaseStyles}>note qty</th>
					<th scope="col" class={thRowBaseStyles}>price</th>
				</tr>
			</thead>
			<tbody use:combobox.items>
				{#each rows as row}
					{@const { isbn, authors, quantity, price, year, title } = row}

					{@const active = $combobox.active === row}
					{@const selected = $combobox.selected === row}

					{@const hasCopies = quantity === 0 ? false : true}
					<tr
						use:combobox.item={{ value: row }}
						class={`whitespace-nowrap text-sm font-light text-gray-500 ${active || selected ? "bg-gray-100" : "even:bg-gray-50"}`}
					>
						<th scope="row" class="py-4 px-3 text-left font-medium text-gray-800">
							{isbn}
							<dl class="font-normal">
								<dt class="sr-only">Title:</dt>
								<dd class="mt-1 truncate font-light text-gray-500">{title}</dd>
								<dt class="sr-only">Authors:</dt>
								<dd class="mt-1 truncate font-light text-gray-500">{authors}</dd>
								<dt class="sr-only">Year:</dt>
								<dd class="mt-1 truncate font-light text-gray-500">{year}</dd>
							</dl>
						</th>
						<td class="py-4 px-3 text-left">
							<Badge
								label={hasCopies ? `${quantity} copy(s)` : "No copies"}
								color={hasCopies ? BadgeColor.Success : BadgeColor.Neutral}
								size={BadgeSize.LG}
							/>
						</td>
						<td class="py-4 px-3 text-left">
							{price}
						</td>
					</tr>
				{:else}
					<td class="relative cursor-default select-none py-2 px-4 text-gray-900">
						<span class="truncate font-normal">No results</span>
					</td>
				{/each}
			</tbody>
		</table>
	</div>
</Transition>

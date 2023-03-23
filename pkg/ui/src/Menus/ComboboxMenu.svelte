<script lang="ts">
	import Transition from "svelte-transition";
	import { Check } from "lucide-svelte";

	import type { createCombobox } from "svelte-headlessui";

	export let combobox: ReturnType<typeof createCombobox>;
	export let options: string[];

	$: filtered = options.filter((person) =>
		person.toLowerCase().replace(/\s+/g, "").includes($combobox.filter.toLowerCase().replace(/\s+/g, ""))
	);
</script>

<Transition
	show={$combobox.expanded}
	leave="transition ease-in duration-100"
	leaveFrom="opacity-100"
	leaveTo="opacity-0"
	on:after-leave={() => combobox.reset()}
>
	<ul use:combobox.items class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-md">
		{#each filtered as value}
			{@const active = $combobox.active === value}
			{@const selected = $combobox.selected === value}
			<li
				class="relative cursor-pointer select-none py-2 pl-10 pr-4 {active ? 'bg-teal-500 text-white' : 'text-gray-900'}"
				use:combobox.item={{ value }}
			>
				<span class="block truncate {selected ? 'font-medium' : 'font-normal'}">{value}</span>
				{#if selected}
					<span class="absolute inset-y-0 left-0 flex items-center pl-3 {active ? 'text-white' : 'text-teal-500'}">
						<Check />
					</span>
				{/if}
			</li>
		{:else}
			<li class="relative cursor-default select-none py-2 pl-10 pr-4 text-gray-900">
				<span class="block truncate font-normal">Nothing found</span>
			</li>
		{/each}
	</ul>
</Transition>

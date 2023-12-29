<script lang="ts">
	import { Listbox, ListboxLabel, ListboxButton, ListboxOptions, ListboxOption, Transition } from "@rgossiaux/svelte-headlessui";
	import { Check, ChevronDown } from "lucide-svelte";
	import { createEventDispatcher } from "svelte";

	interface Option {
		value: string;
		action?: string;
		description?: string;
	}

	export let options: Option[];
	export let align: "left" | "right" = "left";

	export let value = options[0].value;

	// We need to handle the change internally because we need to update the value
	// but we want to dispatch the event to the parent as well
	const dispatch = createEventDispatcher();
	const handleChange = (e: CustomEvent) => {
		value = e.detail;
		dispatch("change", e.detail.value);
	};
</script>

<Listbox {...$$restProps} {value} on:change={handleChange} let:open>
	<div class="relative inline-block select-none text-left">
		<ListboxLabel class="sr-only" />
		<div
			class="{$$props.disabled
				? 'divide-gray-200 bg-gray-50 text-gray-500 ring-[1px] ring-gray-200'
				: 'divide-teal-600 bg-teal-500 text-white'} inline-flex divide-x rounded-md text-sm font-medium shadow-sm"
		>
			<div class="inline-flex items-center gap-x-2 rounded-l-md py-2 px-4">
				<Check aria-hidden="true" />
				<p id="current-value" data-value={value} class="capitalize">{value}</p>
			</div>
			{#if !$$props.disabled}
				<ListboxButton
					class="{$$props.disabled
						? ''
						: 'hover:bg-teal-600'}inline-flex items-center rounded-l-none rounded-r-md p-2 focus:outline-none focus:ring-2"
				>
					<span class="sr-only" />
					<ChevronDown aria-hidden="true" />
				</ListboxButton>
			{/if}
		</div>

		<Transition show={open} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
			<ListboxOptions
				class="{align === 'left'
					? 'left-0'
					: 'right-0'} focus:outline-none' absolute z-10 mt-2 w-72 origin-top-right cursor-pointer divide-y divide-gray-200 overflow-hidden rounded-md shadow-lg ring-1 ring-black ring-opacity-5"
			>
				{#each options as option (option.value)}
					<ListboxOption value={option.value} let:selected let:active>
						<div class="group whitespace-normal py-[10px] px-4 hover:bg-teal-500 {active ? 'bg-teal-500' : 'bg-white'}">
							<div class="flex justify-between">
								<p
									data-option={option.value}
									class="capitalize group-hover:text-white
										{selected ? 'font-semibold' : 'font-normal'}
										{active ? 'text-white' : 'text-gray-900'}"
								>
									{option.action || option.value}
								</p>
								{#if selected}
									<Check aria-hidden="true" class="group-hover:text-white {active ? 'text-white' : 'text-teal-500'}" />
								{/if}
							</div>
							{#if option.description}
								<p class="{active ? 'text-white' : 'text-gray-500'} group-hover:text-white group-active:text-white">
									{option.description}
								</p>
							{/if}
						</div>
					</ListboxOption>
				{/each}
			</ListboxOptions>
		</Transition>
	</div>
</Listbox>

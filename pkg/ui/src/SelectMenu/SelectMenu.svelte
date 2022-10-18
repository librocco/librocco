<script lang="ts">
	import {
		Listbox,
		ListboxLabel,
		ListboxButton,
		ListboxOptions,
		ListboxOption,
		Transition
	} from '@rgossiaux/svelte-headlessui';
	import { Check, ChevronDown } from 'lucide-svelte';

	import { AlignContainerEdge } from './enums';

	import { classNames } from '$utils/styles';

	interface Option {
		title: string;
		description: string;
	}

	export let options: Option[];
	export let currentOptionIndex: number = 0;
	export let alignItemsEdge: AlignContainerEdge = AlignContainerEdge.Right;
	export let ariaLabel = 'Change status';

	let selected: Option;
	$: selected = options[currentOptionIndex];

	const buttonClasses = [
		'inline-flex',
		'items-center',
		'rounded-l-none',
		'rounded-r-md',
		'bg-teal-500',
		'p-2',
		'hover:bg-teal-600',
		'focus:outline-none',
		'focus:ring-2',
		'focus:ring-teal-500',
		'focus:ring-offset-2',
		'focus:ring-offset-gray-50'
	].join(' ');

	const optionsClasses = [
		'absolute',
		alignItemsEdge,
		'z-10',
		'mt-2',
		'w-72',
		'origin-top-right',
		'divide-y',
		'divide-gray-200',
		'overflow-hidden',
		'rounded-md',
		'bg-white',
		'shadow-lg',
		'ring-1',
		'ring-black',
		'ring-opacity-5',
		'focus:outline-none'
	].join(' ');
</script>

<Listbox value={selected} on:change={(e) => (selected = e.detail)} let:open>
	<div class="relative inline-block text-left">
		<ListboxLabel class="sr-only">{ariaLabel}</ListboxLabel>
		<div
			class="inline-flex divide-x divide-teal-600 rounded-md shadow-sm text-white text-sm font-medium"
		>
			<div class="inline-flex items-center gap-x-2 rounded-l-md bg-teal-500 py-2 px-4">
				<Check aria-hidden="true" />
				<p>{selected.title}</p>
			</div>
			<ListboxButton class={buttonClasses}>
				<span class="sr-only">{ariaLabel}</span>
				<ChevronDown aria-hidden="true" />
			</ListboxButton>
		</div>

		<Transition
			show={open}
			leave="transition ease-in duration-100"
			leaveFrom="opacity-100"
			leaveTo="opacity-0"
		>
			<ListboxOptions class={optionsClasses}>
				{#each options as option, ix (ix)}
					<ListboxOption value={option} let:selected let:active>
						<div
							class={classNames(
								'group p-2.5 hover:bg-teal-500',
								active ? 'bg-teal-500' : 'bg-white'
							)}
						>
							<div class="flex justify-between">
								<p
									class={classNames(
										'group-hover:text-white',
										selected ? 'font-semibold' : 'font-normal',
										active ? 'text-white' : 'text-gray-900'
									)}
								>
									{option.title}
								</p>
								{#if selected}
									<Check
										aria-hidden="true"
										class={classNames(
											'group-hover:text-white',
											active ? 'text-white' : 'text-teal-500'
										)}
									/>
								{/if}
							</div>
							<p class="text-gray-500 group-hover:text-gray-200 group-active:text-gray-200">
								{option.description}
							</p>
						</div>
					</ListboxOption>
				{/each}
			</ListboxOptions>
		</Transition>
	</div>
</Listbox>

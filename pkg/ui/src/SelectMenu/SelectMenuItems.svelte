<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	import { SELECT, type SelectMenuContext } from './SelectMenuContext.svelte';

	export let items: { label: string; description: string }[];

	export let ariaLabel = 'Select an option';

	const { selectItem, registerItem, current } = getContext<SelectMenuContext>(SELECT);

	onMount(() => {
		items.forEach((item) => registerItem(item.label));
	});

	const handleSelectOnChange = (e: Event) => {
		const target = e.currentTarget as HTMLLIElement;
		const text = target.getElementsByTagName('p').item(0)
			? (target.getElementsByTagName('p').item(0) || {}).innerText
			: '';
		selectItem(text || '');
	};
</script>

<div transition:fade>
	<ul
		class="absolute  z-10 mt-2 w-72 origin-top-right divide-y divide-gray-200 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
		tabindex="-1"
		role="listbox"
		aria-labelledby="listbox-label"
		aria-label={ariaLabel}
		aria-activedescendant="listbox-option-0"
	>
		{#each items as item, i}
			<li
				class="group text-gray-600 cursor-default select-none p-4 text-sm hover:text-white hover:bg-teal-500"
				id={`listbox-option-${i}`}
				role="option"
				on:click={handleSelectOnChange}
			>
				<div class="flex flex-col">
					<div class="flex justify-between">
						<p class="font-normal group-hover:font-semibold">{item.label}</p>

						{#if item.label === $current}
							<!-- @TODO replace with svg -->
							<span class="text-yellow-500 group-hover:text-white">
								<svg
									class="h-5 w-5"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 20 20"
									fill="currentColor"
									aria-hidden="true"
								>
									<path
										fill-rule="evenodd"
										d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
										clip-rule="evenodd"
									/>
								</svg>
							</span>
						{/if}
					</div>
					<p class="text-gray-500 mt-2 group-hover:text-teal-200">{item.description}</p>
				</div>
			</li>
		{/each}
	</ul>
</div>

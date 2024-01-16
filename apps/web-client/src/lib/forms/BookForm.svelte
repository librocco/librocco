<script lang="ts" context="module">
	import type { SuperForm } from "sveltekit-superforms/client";

	export type BookFormOptions = SuperForm<ZodValidation<typeof bookSchema>, unknown>["options"];
</script>

<script lang="ts">
	import type { ZodValidation } from "sveltekit-superforms";
	import { superForm, superValidateSync, numberProxy } from "sveltekit-superforms/client";

	import { createCombobox, melt } from "@melt-ui/svelte";
	import { Check, ChevronsUpDown } from "lucide-svelte";
	import { fly } from "svelte/transition";

	import { bookSchema, type BookFormData } from "$lib/forms/schemas";

	import { Input, NewCheckbox } from "$lib/components/FormControls";

	export let data: BookFormData | null;
	export let options: BookFormOptions;
	export let publisherList: string[] = [];

	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	const form = superForm(superValidateSync(data, bookSchema), options);

	const { form: formStore, constraints, enhance } = form;

	const priceProxy = numberProxy(formStore, "price", { emptyIfZero: false, empty: "undefined" });

	$: publishers = publisherList.map(
		(option) => (typeof option === "string" ? { value: option, label: option } : option) as { value: string; label: string }
	);

	const {
		elements: { menu, input, option, label },
		states: { open, inputValue, touchedInput, selected }
	} = createCombobox<{ value: string; label: string }>({
		forceVisible: true,
		onSelectedChange: ({ next }) => inputValue.set(next!.value)
	});

	$: {
		$inputValue = $formStore.publisher;
	}

	$: filteredPublishers = $touchedInput ? publishers.filter(({ value }) => value.includes($inputValue)) : publishers;
</script>

<form class="divide-y-gray-50 flex h-auto flex-col gap-y-6 px-4" aria-label="Edit book details" use:enhance method="POST" id="book-form">
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div id="isbn-field-container" class="basis-full">
				<Input bind:value={$formStore.isbn} name="isbn" label="ISBN" placeholder="0000000000" {...$constraints.isbn} disabled />
			</div>
			<div id="title-field-container" class="basis-full">
				<Input bind:value={$formStore.title} name="title" label="Title" placeholder="" {...$constraints.title} />
			</div>
			<div id="price-field-container" class="flex basis-full justify-between gap-x-4">
				<Input bind:value={$priceProxy} name="price" label="Price" placeholder="0" type="number" step="any" required>
					<span slot="start-adornment">€</span>
				</Input>
				<Input bind:value={$formStore.year} name="year" label="Year" placeholder="" {...$constraints.year} />
			</div>
			<div id="authors-field-container" class="basis-full">
				<Input bind:value={$formStore.authors} name="authors" label="Authors" placeholder="" {...$constraints.authors} />
			</div>
			<div id="publisher-field-container" class="relative basis-full">
				<Input
					name="publisher"
					autocomplete="off"
					label="Publisher"
					inputAction={$input.action}
					{...$input}
					bind:value={$formStore.publisher}
				>
					<div slot="end-adornment">
						<ChevronsUpDown class="text-gray-400" />
					</div>
				</Input>
				{#if $open}
					<ul
						use:melt={$menu}
						class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-md"
						transition:fly={{ duration: 150, y: -5 }}
					>
						{#each filteredPublishers as _option}
							<li
								class="data-[highlighted]:bg-teal-500 data-[highlighted]:text-white relative cursor-pointer select-none py-2 pl-10 pr-4 text-gray-900"
								use:melt={$option(_option)}
							>
								<span class="block truncate {selected ? 'font-medium' : 'font-normal'}">{_option.label}</span>
								{#if selected}
									<span class="data-[highlighted]:text-white absolute inset-y-0 left-0 flex items-center pl-3 text-teal-500">
										<Check />
									</span>
								{/if}
							</li>
						{:else}
							<li class="relative cursor-default select-none py-2 pl-10 pr-4 text-gray-900">
								<span class="block truncate font-normal">No results found</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			<div id="editedBy-field-container" class="basis-full">
				<Input bind:value={$formStore.editedBy} name="editedBy" label="Edited by" placeholder="" {...$constraints.editedBy} />
			</div>
			<div id="outOfPrint-field-container" class="basis-full">
				<NewCheckbox
					bind:checked={$formStore.outOfPrint}
					id="outOfPrint"
					name="outOfPrint"
					label="Out of Print"
					helpText="This book is no longer available from the publisher"
					{...$constraints.outOfPrint}
				/>
			</div>
		</div>
	</div>
	<div class="flex w-full justify-end gap-x-2">
		<button class="button button-alert" on:click={onCancel} type="button"> Cancel </button>
		<button class="button button-green" type="submit"> Save </button>
	</div>
</form>

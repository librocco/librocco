<script lang="ts" context="module">
	import type { SuperForm } from "sveltekit-superforms/client";

	type BookForm = SuperForm<ZodValidation<typeof bookSchema>, unknown>;
	export type BookFormOptions = BookForm["options"];
</script>

<script lang="ts">
	import { fly } from "svelte/transition";

	import type { ZodValidation } from "sveltekit-superforms";
	import { superForm, superValidateSync, numberProxy, stringProxy } from "sveltekit-superforms/client";

	import { createCombobox, melt, type ComboboxOptionProps } from "@melt-ui/svelte";
	import { Check, ChevronUp, ChevronDown } from "lucide-svelte";

	import { bookSchema, type BookFormData } from "$lib/forms/schemas";

	import { Input, Checkbox } from "$lib/components/FormControls";

	export let data: BookFormData | null;
	export let options: BookFormOptions;
	export let publisherList: string[] = [];

	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	export let onFetch: (isbn: string, form: BookForm["form"]) => void = () => {};

	const _form = superValidateSync(data, bookSchema);
	const form = superForm(_form, options);

	const { form: formStore, constraints, enhance } = form;

	const priceProxy = numberProxy(formStore, "price", { emptyIfZero: false, empty: "undefined" });
	const publisherProxy = stringProxy(formStore, "publisher", { empty: "undefined" });

	/**
	 * Publisher combobox
	 */
	const {
		elements: { menu, input, option },
		states: { open, inputValue, touchedInput, selected },
		helpers: { isSelected, isHighlighted }
	} = createCombobox<string>({
		forceVisible: true,
		onSelectedChange: ({ next }) => {
			const { value } = next;

			/**
			 * Without this inputValue will not matched selected options
			 */
			inputValue.set(value);
			publisherProxy.set(value);

			return next;
		}
	});

	/**
	 * Maps publisher strings to select options
	 * @param publisher
	 */
	const toOption = (publisher: string): ComboboxOptionProps<string> => ({
		value: publisher,
		label: publisher,
		disabled: false
	});

	/**
	 * Update selected as the publisher value changes in the formStore
	 * This way a user could selected e.g "Publisher 2", but then edit the value to "Publisher"
	 * and the initial value will not be shown as selected in the combobox menu
	 */
	$: {
		const { publisher = "" } = $formStore;
		$selected = toOption(publisher);
	}

	/**
	 * Filters the combobox list to show relevant options as input is provided
	 */
	$: filteredPublishers = $touchedInput ? publisherList.filter((publisher) => publisher.includes($inputValue)) : publisherList;
</script>

<form
	class="divide-y-gray-50 flex h-auto flex-col gap-y-6 px-4 py-4"
	aria-label="Edit book details"
	use:enhance
	method="POST"
	id="book-form"
>
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div id="isbn-field-container" class="flex basis-full gap-x-4">
				<div class="grow">
					<Input bind:value={$formStore.isbn} name="isbn" label="ISBN" placeholder="0000000000" {...$constraints.isbn} disabled />
				</div>
				<button type="button" class="button button-alert mb-0.5 self-end" on:click={() => onFetch($formStore.isbn, formStore)}>
					Fill details
				</button>
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
						{#if $open}
							<ChevronUp class="square-4" />
						{:else}
							<ChevronDown class="square-4" />
						{/if}
					</div>
				</Input>
				{#if $open}
					<ul
						use:melt={$menu}
						class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-md"
						transition:fly={{ duration: 150, y: -5 }}
					>
						{#each filteredPublishers as publisher}
							{@const isSelected = $isSelected(publisher)}
							{@const isHighlighed = $isHighlighted(publisher)}

							<li
								class="relative cursor-pointer select-none py-2 pl-10 pr-4 text-gray-900 data-[highlighted]:bg-teal-500 data-[highlighted]:text-white"
								use:melt={$option(toOption(publisher))}
							>
								<span class="block truncate {isSelected ? 'font-medium' : 'font-normal'}">{publisher}</span>
								{#if isSelected}
									<span class="absolute inset-y-0 left-0 flex items-center pl-3 {isHighlighed ? 'text-white' : 'text-teal-500'}">
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
				<Checkbox
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
		<button class="button button-white" on:click={onCancel} type="button"> Cancel </button>
		<button class="button button-green disabled:bg-gray-400" type="submit"> Save </button>
	</div>
</form>

<script lang="ts">
	import { fly } from "svelte/transition";
	import { derived } from "svelte/store";

	import type { FormOptions, SuperValidated, SuperForm } from "sveltekit-superforms";
	import { superForm, numberProxy, stringProxy } from "sveltekit-superforms/client";

	import { createCombobox, melt, type ComboboxOptionProps } from "@melt-ui/svelte";
	import Check from "$lucide/check";
	import ChevronUp from "$lucide/chevron-up";
	import ChevronDown from "$lucide/chevron-down";
	import Euro from "$lucide/euro";

	import { testId } from "@librocco/shared";

	import type { BookFormSchema } from "$lib/forms/schemas";

	import { Input, Checkbox } from "$lib/components/FormControls";

	export let data: SuperValidated<BookFormSchema>;
	export let options: FormOptions<BookFormSchema>;
	export let publisherList: string[] = [];

	export let isExtensionAvailable: boolean;

	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	export let onFetch: (isbn: string, form: SuperForm<BookFormSchema>["form"]) => void = () => {};

	const form = superForm(data, options);

	const { form: formStore, constraints, enhance } = form;

	const priceProxy = numberProxy(formStore, "price", { empty: "undefined" });
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
	const publisher = derived(formStore, ($formStore) => $formStore.publisher || "");

	/**
	 * Filters the combobox list to show relevant options as input is provided
	 */
	const filteredPublishers = derived([touchedInput, inputValue], ([$touchedInput, $inputValue]) => {
		return $touchedInput ? publisherList.filter((publisher) => publisher.includes($inputValue)) : publisherList;
	});

	// Derive selected and highlighted states
	const selectedStates = derived([filteredPublishers, isSelected, isHighlighted], ([$filteredPublishers, $isSelected, $isHighlighted]) => {
		return $filteredPublishers.map((publisher) => ({
			publisher,
			isSelected: $isSelected(publisher),
			isHighlighted: $isHighlighted(publisher)
		}));
	});
</script>

<form
	class="divide-y-secondary flex flex-col gap-y-10 px-4 py-4"
	aria-label="Edit book details"
	use:enhance
	method="POST"
	id={testId("book-form")}
>
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div id="isbn-field-container" class="flex basis-full items-center gap-x-4">
				<label class="form-control grow">
					<div class="label">
						<span class="label-text">ISBN</span>
					</div>
					<input
						bind:value={$formStore.isbn}
						name="isbn"
						placeholder="0000000000"
						{...$constraints.isbn}
						disabled
						class="input-bordered input w-full"
					/>
				</label>
				<button
					disabled={!isExtensionAvailable}
					type="button"
					class={["btn-secondary btn self-end", `${!isExtensionAvailable && "bg-gray-200 text-gray-500 hover:bg-gray-200"}`].join(" ")}
					on:click={() => onFetch($formStore.isbn, formStore)}
				>
					Fill details
				</button>
			</div>

			<label class="form-control basis-full" id="title-field-container">
				<div class="label">
					<span class="label-text">Title</span>
				</div>
				<input bind:value={$formStore.title} name="title" placeholder="" {...$constraints.title} class="input-bordered input w-full" />
			</label>

			<div class="flex basis-full gap-x-2">
				<label class="form-control basis-1/2" id="price-field-container">
					<span class="label">
						<span class="label-text">Price</span>
					</span>
					<span class="input-bordered input flex items-center gap-2">
						<Euro class="text-base-content/50" />
						<input bind:value={$priceProxy} name="price" placeholder="0" type="number" step="any" required class="w-1/2" />
					</span>
				</label>

				<label class="form-control basis-1/2" id="year-field-container">
					<div class="label">
						<span class="label-text">Year</span>
					</div>
					<input bind:value={$formStore.year} name="year" placeholder="" {...$constraints.year} class="input-bordered input w-full" />
				</label>
			</div>

			<label class="form-control basis-1/2" id="authors-field-container">
				<div class="label">
					<span class="label-text">Authors</span>
				</div>
				<input
					bind:value={$formStore.authors}
					name="authors"
					placeholder=""
					{...$constraints.authors}
					class="input-bordered input w-full"
				/>
			</label>

			<div id="publisher-field-container" class="relative basis-full">
				<label class="form-control basis-1/2" id="year-field-container">
					<span class="label">
						<span class="label-text">Publisher</span>
					</span>
					<span class="input-bordered input flex items-center gap-2">
						<input name="publisher" autocomplete="off" use:melt={$input} bind:value={$formStore.publisher} class="w-full" />
						<span>
							{#if $open}
								<ChevronUp class="square-4" />
							{:else}
								<ChevronDown class="square-4" />
							{/if}
						</span>
					</span>
				</label>

				{#if $open}
					<ul
						use:melt={$menu}
						class="bg-base-100 absolute z-[200] mt-1 max-h-60 w-full overflow-auto rounded-md py-1 text-base shadow-md"
						transition:fly|global={{ duration: 150, y: -5 }}
					>
						{#each $selectedStates as { publisher, isSelected, isHighlighted }}
							<li
								class="text-base-content data-[highlighted]:bg-primary data-[highlighted]:text-primary-content relative cursor-pointer select-none py-2 pl-10 pr-4"
								use:melt={$option(toOption(publisher))}
							>
								<span class="block truncate {isSelected ? 'font-medium' : 'font-normal'}">{publisher}</span>
								{#if isSelected}
									<span class="absolute inset-y-0 left-0 flex items-center pl-3 {isHighlighted ? 'text-primary-content' : 'text-primary'}">
										<Check />
									</span>
								{/if}
							</li>
						{:else}
							<li class="relative cursor-default select-none py-2 pl-10 pr-4">
								<span class="block truncate font-normal">No results found</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<label class="form-control basis-full" id="editedBy-field-container">
				<div class="label">
					<span class="label-text">Edited by</span>
				</div>
				<input
					bind:value={$formStore.editedBy}
					name="editedBy"
					placeholder=""
					{...$constraints.editedBy}
					class="input-bordered input w-full"
				/>
			</label>

			<label class="form-control basis-full" id="category-field-container">
				<div class="label">
					<span class="label-text">Category</span>
				</div>
				<input
					bind:value={$formStore.category}
					name="category"
					placeholder=""
					{...$constraints.category}
					class="input-bordered input w-full"
				/>
			</label>

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
		<button class="btn-secondary btn-outline btn" on:click={onCancel} type="button">Cancel</button>
		<button class="btn-primary btn disabled:bg-gray-400" type="submit">Save</button>
	</div>
</form>

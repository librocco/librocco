<script lang="ts">
	import type { ZodValidation } from "sveltekit-superforms";
	import type { SuperForm } from "sveltekit-superforms/client";
	import { superForm, superValidateSync, numberProxy } from "sveltekit-superforms/client";

	import { bookScehma, type BookFormData } from "$lib/forms/schemas";

	import { Input, Checkbox } from "$lib/components/FormControls";

	type Form = SuperForm<ZodValidation<typeof bookScehma>, unknown>;

	export let data: BookFormData;
	export let options: Form["options"];
	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	const form = superForm(superValidateSync(data, bookScehma), options);

	const { form: formStore, constraints, enhance } = form;

	const priceProxy = numberProxy(formStore, "price", { emptyIfZero: false, empty: "undefined" });
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
		<button class="button button-alert" on:click={onCancel}> Cancel </button>
		<button class="button button-green"> Save </button>
	</div>
</form>

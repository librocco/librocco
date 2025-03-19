<script lang="ts">
	import type { FormOptions, SuperValidated, SuperForm } from "sveltekit-superforms";
	import { superForm, numberProxy, stringProxy } from "sveltekit-superforms/client";

	import { testId } from "@librocco/shared";

	import type { BookFormSchema } from "$lib/forms/schemas";

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
</script>

<form
	class="divide-y-gray-50 flex h-auto flex-col gap-y-6 px-4 py-4"
	aria-label="Edit book details"
	use:enhance
	method="POST"
	id={testId("book-form")}
>
	<div class="flex justify-between">
		<label class="input-bordered input flex items-center gap-2">
			ISBN
			<input bind:value={$formStore.isbn} name="isbn" type="text" class="grow" placeholder="0000000000" {...$constraints.isbn} disabled />
		</label>
		<button disabled={!isExtensionAvailable} type="button" class="btn-secondary btn" on:click={() => onFetch($formStore.isbn, formStore)}>
			Fill details
		</button>
	</div>

	<label class="input-bordered input flex items-center gap-2">
		Title*
		<input bind:value={$formStore.title} name="title" type="text" class="grow" {...$constraints.title} required />
	</label>
	<label class="input-bordered input flex items-center gap-2">
		Price*
		<input bind:value={$priceProxy} class="grow" name="price" type="float" placeholder="0" required />
		€
	</label>
	<label class="input-bordered input flex items-center gap-2">
		Year
		<input bind:value={$formStore.year} name="year" type="number" {...$constraints.year} />
	</label>
	<label class="input-bordered input flex items-center gap-2">
		Authors
		<input bind:value={$formStore.authors} name="authors" type="text" {...$constraints.authors} />
	</label>
	<label class="form-control w-full">
		<div class="label">Publisher</div>
		<select class="select-bordered select w-full" bind:value={$publisherProxy}>
			{#each publisherList as publisher}
				<option>{publisher}</option>
			{/each}
		</select>
	</label>
	<label class="input-bordered input flex items-center gap-2">
		Edited by
		<input bind:value={$formStore.editedBy} name="editedBy" type="text" {...$constraints.editedBy} />
	</label>
	<label class="input-bordered input flex items-center gap-2">
		Category
		<input bind:value={$formStore.category} name="category" type="text" {...$constraints.category} />
	</label>
	<div class="form-control">
		<label class="label cursor-pointer">
			<span class="label-text">Out of Print</span>
			<input bind:checked={$formStore.outOfPrint} type="checkbox" class="checkbox" {...$constraints.outOfPrint} />
		</label>
	</div>
	<div class="flex w-full justify-end gap-x-2">
		<button class="btn" on:click={onCancel} type="button">Cancel</button>
		<button class="btn-success btn" type="submit">Save</button>
	</div>
</form>

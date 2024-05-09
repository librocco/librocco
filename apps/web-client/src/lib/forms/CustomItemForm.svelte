<script lang="ts" context="module">
	import type { SuperForm } from "sveltekit-superforms/client";

	type CustomItem = SuperForm<ZodValidation<typeof customItemSchema>, unknown>;
	export type CustomItemOptions = CustomItem["options"];
</script>

<script lang="ts">
	import type { ZodValidation } from "sveltekit-superforms";
	import { superForm, superValidateSync, numberProxy } from "sveltekit-superforms/client";

	import { testId } from "@librocco/shared";

	import { customItemSchema, type CustomItemFormData } from "$lib/forms/schemas";

	import { Input } from "$lib/components/FormControls";

	export let data: CustomItemFormData;
	export let options: CustomItemOptions;

	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	const _form = superValidateSync(data, customItemSchema);
	const form = superForm(_form, options);

	const { form: formStore, constraints, enhance } = form;

	const priceProxy = numberProxy(formStore, "price", { emptyIfZero: false, empty: "undefined" });
</script>

<form
	class="divide-y-gray-50 flex h-auto flex-col gap-y-6 px-4 py-4"
	aria-label="Edit book details"
	use:enhance
	method="POST"
	id={testId("custom-item-form")}
>
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div id="title-field-container" class="basis-full">
				<Input bind:value={$formStore.title} name="title" label="Title" placeholder="" {...$constraints.title} />
			</div>
			<div id="price-field-container" class="flex basis-full justify-between gap-x-4">
				<Input bind:value={$priceProxy} name="price" label="Price" placeholder="0" type="number" step="any" required>
					<span slot="start-adornment">€</span>
				</Input>
			</div>
		</div>
	</div>
	<div class="flex w-full justify-end gap-x-2">
		<button class="button button-white" on:click={onCancel} type="button">Cancel</button>
		<button class="button button-green disabled:bg-gray-400" type="submit">Save</button>
	</div>
</form>

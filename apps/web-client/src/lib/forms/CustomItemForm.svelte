<script lang="ts">
	import { superForm, numberProxy } from "sveltekit-superforms/client";
	import { Euro } from "lucide-svelte";

	import { testId } from "@librocco/shared";

	import type { CustomItemFormSchema } from "$lib/forms/schemas";

	import { Input } from "$lib/components/FormControls";

	import type { FormOptions, SuperValidated } from "sveltekit-superforms";

	export let data: SuperValidated<CustomItemFormSchema>;
	export let options: FormOptions<CustomItemFormSchema>;

	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	const form = superForm(data, options);

	const { form: formStore, constraints, enhance } = form;

	const priceProxy = numberProxy(formStore, "price", { empty: "zero" });
</script>

<form
	class="divide-y-secondary flex flex-col gap-y-10 px-4 py-4"
	aria-label="Edit book details"
	use:enhance
	method="POST"
	id={testId("custom-item-form")}
>
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<label class="form-control basis-full" id="title-field-container">
				<div class="label">
					<span class="label-text">Title</span>
				</div>
				<input bind:value={$formStore.title} name="title" placeholder="" {...$constraints.title} class="input-bordered input w-full" />
			</label>

			<label class="form-control basis-full" id="price-field-container">
				<span class="label">
					<span class="label-text">Price</span>
				</span>
				<span class="input-bordered input flex items-center gap-2">
					<Euro class="text-base-content/50" />
					<input bind:value={$priceProxy} name="price" placeholder="0" type="number" step="any" required class="w-1/2" />
				</span>
			</label>
		</div>
	</div>
	<div class="flex w-full justify-end gap-x-2">
		<button class="btn-secondary btn-outline btn" on:click={onCancel} type="button">Cancel</button>
		<button class="btn-primary btn disabled:bg-gray-400" type="submit">Save</button>
	</div>
</form>

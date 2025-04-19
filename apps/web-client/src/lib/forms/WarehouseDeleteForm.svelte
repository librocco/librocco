<script lang="ts">
	import { superForm, defaults } from "sveltekit-superforms/client";
	import { zod } from "sveltekit-superforms/adapters";

	import { warehouseDeleteSchema, type WarehouseDeleteFormSchema } from "$lib/forms/schemas";

	import type { FormOptions } from "sveltekit-superforms";

	export let displayName: string;
	const matchConfirmation = displayName
		.toLowerCase()
		// Replace all special characters and spaces with underscores
		.replace(/[^a-z0-9]/g, "_")
		// Remove duplicate underscores
		.replace(/_+/g, "_")
		// Trim leading and trailing underscores
		.replace(/^_+|_+$/g, "");
	const schema = warehouseDeleteSchema(matchConfirmation);

	export let options: FormOptions<WarehouseDeleteFormSchema>;
	export let onCancel: (e: Event) => void = () => {};

	const form = superForm(defaults(zod(schema)), options);

	const { form: formStore, constraints, enhance } = form;
</script>

<form use:enhance method="POST" class="flex max-w-lg flex-col gap-y-6">
	<div class="flex flex-col justify-between gap-y-6 p-4">
		<label class="form-control basis-1/2" id="year-field-container">
			<div class="label">
				<span class="label-text">Confirm by typing warehouse name</span>
			</div>
			<input
				bind:value={$formStore.confirmation}
				name="confirm"
				{...$constraints.confirmation}
				autocomplete="off"
				class="input-bordered input w-full"
			/>
			<div class="label">
				<span class="label-text-alt">Type '{matchConfirmation}'</span>
			</div>
		</label>
	</div>

	<div class="flex w-full justify-end gap-x-2 p-4">
		<button class="btn-secondary btn-outline btn" on:click={onCancel} type="button">Cancel</button>
		<button class="btn-error btn" type="submit">Confirm</button>
	</div>
</form>

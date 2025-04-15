<script lang="ts">
	import { Percent } from "lucide-svelte";
	import { superForm, numberProxy } from "sveltekit-superforms/client";

	import { Input } from "$lib/components/FormControls";
	import type { WarehouseFormSchema } from "$lib/forms/schemas";

	import type { FormOptions, SuperValidated } from "sveltekit-superforms";

	export let data: SuperValidated<WarehouseFormSchema>;
	export let options: FormOptions<WarehouseFormSchema>;
	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	const form = superForm(data, options);

	const { form: formStore, constraints, enhance } = form;

	const discountProxy = numberProxy(formStore, "discount", { empty: "undefined" });
</script>

<form class="flex max-w-lg flex-col gap-y-6" aria-label="Edit warehouse details" use:enhance method="POST" id="warehouse-form">
	<div class="flex flex-col justify-between gap-y-6 p-4">
		<input type="hidden" name="id" value={$formStore.id} />
		<div class="basis-full">
			<label class="form-control grow">
				<div class="label">
					<span class="label-text">Name</span>
				</div>
				<input
					bind:value={$formStore.name}
					name="name"
					placeholder="Warehouse name"
					{...$constraints.name}
					class="input input-bordered w-full"
				/>
			</label>
		</div>
		<div class="w-1/2">
			<label class="form-control basis-1/2">
				<span class="label">
					<span class="label-text">Discount</span>
				</span>
				<span class="input input-bordered flex items-center gap-2">
					<input bind:value={$discountProxy} name="discount" placeholder="0" type="number" step="any" />
					<Percent class="text-base-content/50" />
				</span>
				<span class="label">
					<span class="label-text">Applied to book prices</span>
				</span>
			</label>
		</div>
	</div>
	<div class="flex w-full justify-end gap-x-2 p-4">
		<button class="btn btn-secondary btn-outline" on:click={onCancel} type="button">Cancel</button>
		<button class="btn btn-primary disabled:bg-gray-400" type="submit">Save</button>
	</div>
</form>

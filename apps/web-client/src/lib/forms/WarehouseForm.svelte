<script lang="ts">
	import type { ZodValidation } from "sveltekit-superforms";
	import type { SuperForm } from "sveltekit-superforms/client";
	import { superForm, superValidateSync, numberProxy } from "sveltekit-superforms/client";

	import { warehouseSchema, type WarehouseFormData } from "$lib/forms/schemas";

	import { Input } from "$lib/components/FormControls";
	import { Percent } from "lucide-svelte";

	type Form = SuperForm<ZodValidation<typeof warehouseSchema>, unknown>;

	export let data: WarehouseFormData;
	export let options: Form["options"];
	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	const form = superForm(superValidateSync(data, warehouseSchema), options);

	const { form: formStore, constraints, enhance } = form;

	const discountProxy = numberProxy(formStore, "discount", { emptyIfZero: false, empty: "undefined" });
</script>

<form class="flex max-w-lg flex-col gap-y-6" aria-label="Edit warehouse details" use:enhance method="POST" id="warehouse-form">
	<div class="flex flex-col justify-between gap-y-6 p-6">
		<input type="hidden" name="id" value={$formStore.id} />
		<div class="basis-full">
			<Input bind:value={$formStore.name} name="name" label="Name" placeholder="Warehouse name" {...$constraints.name} />
		</div>
		<div class="w-1/2">
			<Input
				bind:value={$discountProxy}
				name="discount"
				label="Discount"
				placeholder="0"
				type="number"
				step="any"
				helpText="Applied to book price"
			>
				<span class="text-gray-500" slot="end-adornment">
					<Percent />
				</span>
			</Input>
		</div>
	</div>
	<div class="flex w-full justify-end gap-x-2">
		<button class="button button-alert" on:click={onCancel} type="button"> Cancel </button>
		<button class="button button-green"> Save </button>
	</div>
</form>

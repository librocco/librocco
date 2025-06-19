<script lang="ts">
	import { Percent } from "lucide-svelte";
	import { superForm, numberProxy } from "sveltekit-superforms/client";

	import { Input } from "$lib/components/FormControls";
	import type { WarehouseFormSchema } from "$lib/forms/schemas";

	import type { FormOptions, SuperValidated } from "sveltekit-superforms";
	import { LL } from "@librocco/shared/i18n-svelte";

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

<form
	class="flex max-w-lg flex-col gap-y-6"
	aria-label={$LL.forms.warehouse_form.aria.form()}
	use:enhance
	method="POST"
	id="warehouse-form"
>
	<div class="flex flex-col justify-between gap-y-6 p-4">
		<input type="hidden" name="id" value={$formStore.id} />
		<div class="basis-full">
			<label class="form-control grow">
				<div class="label">
					<span class="label-text">{$LL.forms.warehouse_form.labels.name()}</span>
				</div>
				<input
					bind:value={$formStore.name}
					name="name"
					placeholder={$LL.forms.warehouse_form.placeholders.name()}
					{...$constraints.name}
					class="input-bordered input w-full"
				/>
			</label>
		</div>
		<div class="w-1/2">
			<label class="form-control basis-1/2">
				<span class="label">
					<span class="label-text">{$LL.forms.warehouse_form.labels.discount()}</span>
				</span>
				<span class="input-bordered input flex items-center gap-2">
					<input
						bind:value={$discountProxy}
						name="discount"
						placeholder={$LL.forms.warehouse_form.placeholders.discount()}
						type="number"
						step="any"
					/>
					<Percent class="text-base-content/50" />
				</span>
				<span class="label">
					<span class="label-text">{$LL.forms.warehouse_form.labels.discount_help()}</span>
				</span>
			</label>
		</div>
	</div>
	<div class="flex w-full justify-end gap-x-2 p-4">
		<button class="btn-secondary btn-outline btn" on:click={onCancel} type="button"
			>{$LL.forms.warehouse_form.labels.cancel_button()}</button
		>
		<button class="btn-primary btn disabled:bg-gray-400" type="submit">{$LL.forms.warehouse_form.labels.save_button()}</button>
	</div>
</form>

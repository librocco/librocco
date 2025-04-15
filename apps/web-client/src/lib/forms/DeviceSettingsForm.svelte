<script lang="ts">
	import type { FormOptions, SuperValidated } from "sveltekit-superforms";
	import { superForm } from "sveltekit-superforms/client";
	import compare from "just-compare";

	import { Input } from "$lib/components";
	import type { DeviceSettingsSchema } from "./schemas";

	export let data: SuperValidated<DeviceSettingsSchema>;
	export let options: FormOptions<DeviceSettingsSchema>;

	const _form = superForm(data, options);

	const { form: formStore, enhance, tainted } = _form;

	$: hasChanges = $tainted && !compare($formStore, data.data);
</script>

<form
	class="divide-y-secondary flex flex-col gap-y-10 px-4 py-4"
	use:enhance
	method="POST"
	aria-label="Edit remote database connection config"
>
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<label class="form-control basis-full">
				<div class="label">
					<span class="label-text">Label Printer URL</span>
				</div>
				<input id="url" name="labelPrinterUrl" bind:value={$formStore.labelPrinterUrl} class="input input-bordered w-full" />
			</label>

			<label class="form-control basis-full">
				<div class="label">
					<span class="label-text">Receipt Printer URL</span>
				</div>
				<input id="url" name="receiptPrinterUrl" bind:value={$formStore.receiptPrinterUrl} class="input input-bordered w-full" />
			</label>
		</div>
	</div>
	<div class="flex w-full justify-end gap-x-2">
		<button type="submit" class="btn btn-primary disabled:btn-disabled" disabled={!hasChanges}>Save and Reload</button>
	</div>
</form>

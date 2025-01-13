<script lang="ts">
	import type { FormOptions, SuperValidated } from "sveltekit-superforms";
	import { superForm } from "sveltekit-superforms/client";
	import compare from "just-compare";

	import { Input } from "$lib/components";
	import type { SettingsSchema } from "$lib/schemas";

	export let data: SuperValidated<SettingsSchema>;
	export let options: FormOptions<SettingsSchema>;

	const _form = superForm(data, options);

	const { form: formStore, enhance, tainted } = _form;

	$: hasChanges = $tainted && !compare($formStore, data.data);
</script>

<form class="flex h-auto flex-col gap-y-6" use:enhance method="POST" aria-label="Edit remote database connection config">
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div class="basis-full">
				<Input id="url" name="labelPrinterUrl" label="Label Printer URL" bind:value={$formStore.labelPrinterUrl} />
			</div>

			<div class="basis-full">
				<Input id="url" name="receiptPrinterUrl" label="Receipt Printer URL" bind:value={$formStore.receiptPrinterUrl} />
			</div>
		</div>
	</div>
	<div class="flex justify-end gap-x-2 px-4 py-6">
		<button type="submit" class="button button-green" disabled={!hasChanges}>Save and Reload</button>
	</div>
</form>

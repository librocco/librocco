<script lang="ts">
	import type { FormOptions, SuperValidated } from "sveltekit-superforms";
	import { superForm } from "sveltekit-superforms/client";
	import type { Writable } from "svelte/store";
	import compare from "just-compare";

	import { Input } from "$lib/components";
	import type { SyncSettingsSchema } from "./schemas";
	import { LL } from "@librocco/shared/i18n-svelte";

	export let data: SuperValidated<SyncSettingsSchema>;
	export let options: FormOptions<SyncSettingsSchema>;
	export let active: Writable<boolean>;

	const _form = superForm(data, options);

	const { form: formStore, enhance, tainted } = _form;

	$: hasChanges = $tainted && !compare($formStore, data.data);
</script>

<form
	class="divide-y-secondary flex flex-col gap-y-10 px-4 py-4"
	use:enhance
	method="POST"
	aria-label={$LL.forms.sync_settings.aria.form()}
>
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<label class="form-control basis-full">
				<div class="label">
					<span class="label-text">{$LL.forms.sync_settings.labels.database_name()}</span>
				</div>
				<input id="url" name="dbid" bind:value={$formStore.dbid} class="input-bordered input w-full" />
			</label>

			<label class="form-control basis-full">
				<div class="label">
					<span class="label-text">{$LL.forms.sync_settings.labels.remote_sync_url()}</span>
				</div>
				<input id="url" name="url" bind:value={$formStore.url} class="input-bordered input w-full" />
			</label>
		</div>
	</div>

	<div class="flex items-center justify-between gap-x-2">
		<div class="flex items-center gap-x-2">
			<span class="w-10 text-center {$active ? '' : 'font-bold text-error'}">{$LL.forms.sync_settings.labels.connection_status.off()}</span>
			<input type="checkbox" bind:checked={$active} class="toggle" />
			<span class="w-10 text-center {$active ? 'font-bold text-success' : ''}">{$LL.forms.sync_settings.labels.connection_status.on()}</span>
		</div>

		<button type="submit" class="btn-primary btn disabled:btn-disabled" disabled={!hasChanges}>{$LL.forms.sync_settings.labels.save_reload()}</button>
	</div>
</form>

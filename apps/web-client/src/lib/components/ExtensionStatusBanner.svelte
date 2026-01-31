<script lang="ts">
	import { invalidateAll } from "$app/navigation";

	import LL from "@librocco/shared/i18n-svelte";

	import { app } from "$lib/app";
	import { createSyncState } from "$lib/stores/sync-state";
	import { updateTranslationOverrides, translationOverridesStore, TRANSLATION_OVERRIDES_ENABLED } from "$lib/i18n-overrides";

	const syncState = createSyncState(app.config.syncActive);

	async function updateTranslationsButtonClicked() {
		await updateTranslationOverrides({ notOlderThanSecs: 0 });
		invalidateAll();
	}

	$: remoteDbLabel =
		$syncState.pending > 0
			? `${$LL.misc_components.extension_banner.remote_db()} (${$syncState.pending} pending)`
			: $LL.misc_components.extension_banner.remote_db();

	$: indicatorClass = (() => {
		switch ($syncState.status) {
			case "connecting":
				return "bg-warning";
			case "synced":
			case "syncing":
				return "bg-success";
			case "stuck":
			case "disconnected":
			default:
				return "bg-error";
		}
	})();
</script>

<div class="flex items-center gap-4 py-1.5">
	{#if TRANSLATION_OVERRIDES_ENABLED}
		<button on:click={updateTranslationsButtonClicked} class="badge-content badge-outline badge badge-md gap-x-2">
			<div class="block h-3 w-3 rounded-full align-baseline {$translationOverridesStore.loading ? 'bg-error' : 'bg-success'}"></div>
			<p class="leading-none">{$LL.misc_components.extension_banner.reload_translations_override()}</p>
		</button>
	{/if}
	<div
		class="badge-content badge-outline badge badge-md gap-x-2"
		data-testid="remote-db-badge"
		data-status={$syncState.status}
		data-pending={$syncState.pending}
	>
		<div class="block h-3 w-3 rounded-full align-baseline {indicatorClass}"></div>
		<p class="leading-none">{remoteDbLabel}</p>
	</div>
</div>

<script lang="ts">
	import { invalidateAll } from "$app/navigation";

	import LL from "@librocco/shared/i18n-svelte";

	import { app } from "$lib/app";
	import type { PluginsInterface } from "$lib/plugins";
	import { createExtensionAvailabilityStore } from "$lib/stores";
	import { createSyncState } from "$lib/stores/sync-state";
	import { updateTranslationOverrides, translationOverridesStore, TRANSLATION_OVERRIDES_ENABLED } from "$lib/i18n-overrides";

	export let plugins: PluginsInterface;

	const syncState = createSyncState(app.config.syncActive);
	$: extensionAvailable = createExtensionAvailabilityStore(plugins);

	async function updateTranslationsButtonClicked() {
		await updateTranslationOverrides({ notOlderThanSecs: 0 });
		invalidateAll();
	}

	$: remoteDbLabel = (() => {
		if ($syncState.status === "incompatible") {
			return `${$LL.misc_components.extension_banner.remote_db()} (incompatible)`;
		}

		if ($syncState.status === "disconnected") {
			return `${$LL.misc_components.extension_banner.remote_db()} (sync disabled)`;
		}

		if ($syncState.status === "connecting") {
			const detail = $syncState.reason === "checking_compatibility" ? "checking compatibility" : "reconnecting";
			return `${$LL.misc_components.extension_banner.remote_db()} (${detail})`;
		}

		if ($syncState.status === "stuck") {
			return `${$LL.misc_components.extension_banner.remote_db()} (reconnect loop)`;
		}

		if ($syncState.status === "warning") {
			const detail =
				$syncState.reason === "local_db_warning"
					? "local db warning"
					: $syncState.reason === "ack_stale"
						? "ack stale"
						: $syncState.reason === "pending_stale"
							? "pending stale"
							: "sync warning";
			return `${$LL.misc_components.extension_banner.remote_db()} (${detail})`;
		}

		if ($syncState.pending > 0) {
			return `${$LL.misc_components.extension_banner.remote_db()} (${$syncState.pending} pending)`;
		}

		return $LL.misc_components.extension_banner.remote_db();
	})();

	$: remoteDbTitle = (() => {
		if ($syncState.status === "disconnected") {
			return "Sync is disabled in settings";
		}
		if ($syncState.status === "connecting") {
			return $syncState.reason === "checking_compatibility"
				? "Connected, waiting for sync compatibility check to complete"
				: "Sync connection is not active. Reconnecting…";
		}
		if ($syncState.status === "warning") {
			return $syncState.message;
		}
		if ($syncState.status === "incompatible") {
			return $syncState.message || "Local and remote databases are not compatible";
		}
		if ($syncState.status === "stuck") {
			return $syncState.message;
		}
		return "Remote DB sync status";
	})();

	$: indicatorClass = (() => {
		switch ($syncState.status) {
			case "connecting":
				return $syncState.reason === "reconnecting" ? "bg-error" : "bg-warning";
			case "warning":
				return "bg-warning";
			case "synced":
			case "syncing":
				return "bg-success";
			case "incompatible":
				return "bg-error";
			case "stuck":
				return "bg-warning";
			case "disconnected":
				return "bg-base-content/40";
			default:
				return "bg-base-content/40";
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
	<div class="badge-content badge-outline badge badge-md gap-x-2">
		<div class="block h-3 w-3 rounded-full align-baseline {$extensionAvailable ? 'bg-success' : 'bg-error'}"></div>
		<p class="leading-none">{$LL.misc_components.extension_banner.book_data_extension()}</p>
	</div>
	<div
		class="badge-content badge-outline badge badge-md gap-x-2"
		data-testid="remote-db-badge"
		data-status={$syncState.status}
		data-pending={$syncState.pending}
		data-reason={
			$syncState.status === "connecting" || $syncState.status === "incompatible" || $syncState.status === "warning" || $syncState.status === "stuck"
				? $syncState.reason
				: ""
		}
		title={remoteDbTitle}
	>
		<div class="block h-3 w-3 rounded-full align-baseline {indicatorClass}"></div>
		<p class="leading-none">{remoteDbLabel}</p>
	</div>
</div>

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

	const preferLocalized = (localized: string, fallback?: string) => {
		const localizedTrimmed = localized?.trim();
		if (localizedTrimmed) return localizedTrimmed;
		const fallbackTrimmed = fallback?.trim();
		return fallbackTrimmed ?? "";
	};

	const getOptionalBannerLocalized = (key: string) => {
		const banner = $LL.misc_components.extension_banner as unknown as Record<string, (() => string) | undefined>;
		const keyFn = banner[key];
		return typeof keyFn === "function" ? keyFn() : "";
	};

	$: remoteDbLabel = (() => {
		if ($syncState.status === "incompatible") {
			return $LL.misc_components.extension_banner.remote_db_incompatible();
		}

		if ($syncState.status === "disconnected") {
			return $LL.misc_components.extension_banner.remote_db_sync_disabled();
		}

		if ($syncState.status === "connecting") {
			return $syncState.reason === "checking_compatibility"
				? $LL.misc_components.extension_banner.remote_db_connecting_checking_compatibility()
				: $LL.misc_components.extension_banner.remote_db_connecting_reconnecting();
		}

		if ($syncState.status === "stuck") {
			return $LL.misc_components.extension_banner.remote_db_stuck();
		}

		if ($syncState.status === "warning") {
			if ($syncState.reason === "local_db_warning") {
				return $LL.misc_components.extension_banner.remote_db_warning_local_db_warning();
			}
			if ($syncState.reason === "ack_stale") {
				return $LL.misc_components.extension_banner.remote_db_warning_ack_stale();
			}
			if ($syncState.reason === "pending_stale") {
				return $LL.misc_components.extension_banner.remote_db_warning_pending_stale();
			}
			return $LL.misc_components.extension_banner.remote_db_warning();
		}

		if ($syncState.pending > 0) {
			return $LL.misc_components.extension_banner.remote_db_pending({ pending: $syncState.pending });
		}

		return $LL.misc_components.extension_banner.remote_db();
	})();

	$: remoteDbTitle = (() => {
		if ($syncState.status === "disconnected") {
			return $LL.misc_components.extension_banner.remote_db_title_disconnected();
		}
		if ($syncState.status === "connecting") {
			return $syncState.reason === "checking_compatibility"
				? $LL.misc_components.extension_banner.remote_db_title_connecting_checking_compatibility()
				: $LL.misc_components.extension_banner.remote_db_title_connecting_reconnecting();
		}
		if ($syncState.status === "warning") {
			return preferLocalized(getOptionalBannerLocalized("remote_db_title_warning"), $syncState.message);
		}
		if ($syncState.status === "incompatible") {
			return preferLocalized($LL.misc_components.extension_banner.remote_db_title_incompatible(), $syncState.message);
		}
		if ($syncState.status === "stuck") {
			return preferLocalized(getOptionalBannerLocalized("remote_db_title_stuck"), $syncState.message);
		}
		return $LL.misc_components.extension_banner.remote_db_title_default();
	})();

	$: indicatorClass = (() => {
		switch ($syncState.status) {
			case "connecting":
				return $syncState.reason === "reconnecting" ? "bg-warning" : "bg-base-content/40";
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
		data-reason={$syncState.status === "connecting" ||
		$syncState.status === "incompatible" ||
		$syncState.status === "warning" ||
		$syncState.status === "stuck"
			? $syncState.reason
			: ""}
		title={remoteDbTitle}
	>
		<div class="block h-3 w-3 rounded-full align-baseline {indicatorClass}"></div>
		<p class="leading-none">{remoteDbLabel}</p>
	</div>
</div>

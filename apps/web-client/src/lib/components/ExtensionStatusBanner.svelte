<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { browser } from "$app/environment";

	import LL from "@librocco/shared/i18n-svelte";

	import { app } from "$lib/app";
	import { createSyncState } from "$lib/stores/sync-state";
	import { __forceSyncStateForTests, buildSyncStateForTests } from "$lib/stores/sync-state";
	import { updateTranslationOverrides, translationOverridesStore, TRANSLATION_OVERRIDES_ENABLED } from "$lib/i18n-overrides";

	const syncState = createSyncState(app.config.syncActive);

	if (browser) {
		(window as any).__forceSyncIndicator ??= (state: {
			status?: "disconnected" | "connecting" | "synced" | "syncing" | "stuck" | "incompatible";
			pending?: number;
			lastAckAt?: number | null;
			cause?: string;
		}) => {
			const status = state.status ?? (state.pending && state.pending > 0 ? "syncing" : "synced");
			__forceSyncStateForTests(
				buildSyncStateForTests(status as any, state.pending ?? 0, {
					cause: state.cause,
					lastAckAt: state.lastAckAt ?? null
				})
			);
		};
	}

	async function updateTranslationsButtonClicked() {
		await updateTranslationOverrides({ notOlderThanSecs: 0 });
		invalidateAll();
	}

	$: remoteDbLabel = (() => {
		if ($syncState.status === "incompatible") {
			return `${$LL.misc_components.extension_banner.remote_db()} (incompatible)`;
		}

		return $LL.misc_components.extension_banner.remote_db();
	})();

	$: statusText = (() => {
		let text = `${remoteDbLabel} · ${$syncState.label}`;
		if ($syncState.pending > 0) {
			text += ` (${$syncState.pending} pending)`;
		}
		if ($syncState.ageSeconds != null && $syncState.status === "synced") {
			text += ` · as of ${$syncState.ageSeconds}s ago`;
		}
		return text;
	})();

	$: detailText = (() => {
		const bits: string[] = [];
		if ($syncState.cause) bits.push($syncState.cause);
		if ($syncState.ageSeconds != null && $syncState.status !== "synced") {
			bits.push(`as of ${$syncState.ageSeconds}s ago`);
		}
		return bits.join(" · ");
	})();

	$: ariaText = (() => {
		const pendingText = $syncState.pending > 0 ? `${$syncState.pending} pending changes` : "no pending changes";
		const causeText = $syncState.cause ? `; cause: ${$syncState.cause}` : "";
		const ageText = $syncState.ageSeconds != null ? `; last ack ${$syncState.ageSeconds}s ago` : "";
		return `Sync status: ${$syncState.label}; ${pendingText}${causeText}${ageText}`;
	})();

	$: indicatorClass = (() => {
		switch ($syncState.status) {
			case "connecting":
				return "bg-warning";
			case "synced":
			case "syncing":
				return "bg-success";
			case "incompatible":
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
		data-label={$syncState.label}
		data-cause={$syncState.cause ?? ""}
		data-pending={$syncState.pending}
		title={detailText || ariaText}
		aria-label={ariaText}
	>
		<div class="block h-3 w-3 rounded-full align-baseline {indicatorClass}"></div>
		<div class="flex flex-col leading-none gap-0.5">
			<p class="leading-none">{statusText}</p>
			{#if detailText}
				<p class="text-[11px] leading-none text-neutral-400">{detailText}</p>
			{/if}
		</div>
	</div>
</div>

<script lang="ts">
	interface $$Slots {
		badge: Record<string, never>;
		"action-button": Record<string, never>;
	}

	export let publisherName: string;
	export let testId: string | undefined = undefined;
</script>

<div
	class="flex items-center justify-between border-b border-base-300 px-3 py-1.5 transition-colors hover:bg-base-200/60"
	data-testid={testId}
>
	<span class="flex items-center gap-2 truncate text-[13px] font-normal text-base-content">
		{publisherName}
		<slot name="badge" />
	</span>
	<slot name="action-button" />
</div>

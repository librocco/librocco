<script lang="ts">
	interface $$Slots {
		badge: Record<string, never>;
		"action-button": Record<string, never>;
	}

	export let publisherName: string;
</script>

<div class="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 hover:bg-gray-50">
	<span class="flex items-center gap-2 truncate text-[13px] font-normal text-gray-900">
		{publisherName}
		<slot name="badge" />
	</span>
	<slot name="action-button" />
</div>

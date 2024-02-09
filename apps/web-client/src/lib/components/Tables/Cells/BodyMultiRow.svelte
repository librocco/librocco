<script lang="ts">
	interface DD {
		data: string;
		className: string;
	}
	export let rows: Record<string, DD> = {};
</script>

<dl>
	{#each Object.entries(rows) as [title, { data, className }]}
		<dt class="sr-only">{title}</dt>
		<dd class="truncate text-left {className}">{data}</dd>
	{/each}
</dl>

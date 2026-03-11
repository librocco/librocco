<script lang="ts">
	export let label = "";
	export let value: string | number = 0;
</script>

<div class="flex w-40 items-center justify-between gap-2 rounded-md border border-base-300 bg-base-100 px-2 py-1">
	<div class="text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
	<div class="text-foreground text-lg font-bold">{value}</div>
</div>

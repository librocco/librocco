<script lang="ts">
	export let value: "keep_open" | "reorder";
	let label = {
		keep_open: "Order remains open at supplier",
		reorder: "Missing books must be reordered"
	}[value];
</script>

<div class="p-4 pt-3">
	<p class="border-t border-neutral-200 pt-3">
		<span class="text-muted-foreground text-xs uppercase tracking-wide">ACTION:</span>
		<span class="rounded bg-neutral-100 px-2 py-1 text-xs text-zinc-900">{label}</span>
	</p>
</div>

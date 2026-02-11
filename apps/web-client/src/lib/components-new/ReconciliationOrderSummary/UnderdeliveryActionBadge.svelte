<script lang="ts">
	export let value: "pending" | "queue";
	let label = {
		pending: "Order marked as pending delivery",
		queue: "Missing books added to order queue"
	}[value];
</script>

<div class="p-4 pt-3">
	<p class="border-t border-neutral-200 pt-3">
		<span class="text-muted-foreground text-xs uppercase tracking-wide">ACTION:</span>
		<span class="rounded bg-neutral-100 px-2 py-1 text-xs text-zinc-900">{label}</span>
	</p>
</div>

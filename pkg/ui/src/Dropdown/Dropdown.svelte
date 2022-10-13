<script>
	let visible = false;
</script>

<div class="relative mt-1">
	<div on:click={() => (visible = !visible)}>
		<slot name="trigger" {visible} />
	</div>

	{#if visible}
		<slot name="items" {visible} />
	{/if}
</div>

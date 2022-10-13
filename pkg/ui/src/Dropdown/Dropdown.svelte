<script>
	$: visible = false;
	const toggleVisible = () => (visible = !visible);
</script>

<div class="relative inline-block text-left">
	<div on:click={toggleVisible}>
		<slot name="trigger" {visible} />
	</div>

	{#if visible}
		<slot name="items" />
	{/if}
</div>

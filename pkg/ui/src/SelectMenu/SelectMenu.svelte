<script>
	let visible = false;
	export let current = '';
</script>

<div>
	<div class="relative mt-1">
		<div on:click={() => (visible = !visible)}>
			<slot name="trigger" {visible} />
		</div>

		{#if visible}
			<slot name="items" {current} />
		{/if}
	</div>
</div>

<script lang="ts">
	let className = 'Button';
	export { className as class };
</script>

<button class={className}>
	<slot />
</button>

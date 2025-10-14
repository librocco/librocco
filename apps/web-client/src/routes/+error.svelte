<!-- src/routes/+error.svelte -->
<script>
	export let error;
	export let status;
</script>

<div style="padding: 2rem; text-align: center;">
	<h1>⚠️ Oops! Something went wrong.</h1>
	<p><strong>Status:</strong> {status}</p>
	<p><strong>Message:</strong> {error?.message}</p>

	<button on:click={() => location.reload()}>🔄 Reload</button>
</div>

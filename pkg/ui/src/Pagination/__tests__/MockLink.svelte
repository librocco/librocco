<script lang="ts">
	/**
	 * This is a mock Link component, used solely for testing purposes: to test this component
	 * being passed as a wrapper to the `Pagination` component. It recieves the `to` prop
	 * and calls `navigate` function on click.
	 */
	import { mockNavigate } from './mockNavigate';

	export let to = '';
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<span on:click={() => mockNavigate(to)}>
	<slot />
</span>

<script lang="ts">
	/**
	 * This is an example component used to test svelte components requiring the testing of <slot /> getting
	 * passed to them.
	 *
	 * All the props are passed as 'props' (in svelte testing lobrary if would look something like this):
	 * ```
	 * render(Button, { props: { disabled: true } })
	 * ```
	 *
	 * additionally, slot can be passed as 'slot' the render funciton, like so:
	 * ```
	 * render(Button, { props: { disabled: true }, slot: "Click me" })
	 * ```
	 *
	 * The slot will get passed a an html child to the component (if text), or get rendered as
	 * a svelte component using `<svelte:component this={slot}>`
	 *
	 * The events also get forwarded up, but one caveat is: each event needs to manually be forwarded.
	 * There is a duscussion on the matter (a feature request) to forward all events, but it isn't in yet (as far as I'm aware).
	 * You can track progress on this issue:
	 *
	 * https://github.com/sveltejs/svelte/issues/2837
	 *
	 */

	import type { SvelteComponent } from "svelte";

	import Button from "../Button.svelte";

	export let props = {};
	export let slot: SvelteComponent | string;
</script>

<Button {...props} on:click>
	{#if !slot}
		{null}
	{:else if typeof slot === "string"}
		{slot}
	{:else}
		<svelte:component this={slot} />
	{/if}
</Button>

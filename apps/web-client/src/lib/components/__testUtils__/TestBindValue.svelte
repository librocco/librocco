<script context="module" lang="ts">
	const value = writable();
	/**
	 * A store used by `TestBindValueComponent` to check if the tested component binds to a value in expected way.
	 * It exposes the `value` store and a `reset` method to reset the store to `undefined`. Since this is a module context
	 * variable, it should be reset after each test.
	 *
	 * @example
	 * ```typescript
	 * import { get } from 'svelte/store';
	 * import TestBindValue, { bindValueStore } from '$lib/__testUtils__/TestBindValue.svelte';
	 *
	 * afterEach(() => {
	 *  bindValueStore.reset();
	 * })
	 *
	 * test("should bind to a value", () => {
	 *  const { getByText } = render(TestBindValue, {
	 *   props: {
	 *    Component: MyComponent,
	 *    props: { ...myComponentProps }
	 *   }
	 *  });
	 *
	 *   // ...Perform action that should trigger the bound value to change
	 *
	 *   expect(get(bindValueStore)).toEqual(expectedValue)
	 * });
	 * ```
	 */
	export const bindValueStore = { ...value, reset: () => value.set(undefined) };
</script>

<script lang="ts">
	/**
	 * A component used to test the binding of a value to a component.
	 * I accepts the Component as a prop, render's it using `svelte:component`,
	 * creates a writable store and binds it to the component's `value` prop.
	 * The said writable store is exported from the component.
	 */
	import { writable } from "svelte/store";

	/** A component we're testing. It should accept/expost the `value` property */
	export let Component: any;
	export let props = {};
</script>

<svelte:component this={Component} {...props} bind:value={$value} />

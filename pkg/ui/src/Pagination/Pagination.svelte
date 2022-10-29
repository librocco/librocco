<script lang="ts">
	import type { SvelteComponentDev } from 'svelte/internal';

	import ArrowButton from './ArrowButton.svelte';
	import FallbackWrapper from './FallbackWrapper.svelte';

	import { getItemsToRender } from './utils';
	import { getButtonClasses } from './styles';

	// #region
	let inputClasses = '';
	export { inputClasses as class };
	/**
	 * Maximum number of items to display, should be at least 5 and an odd number.
	 * - if less then 5 is provided, will throw an error
	 * - if even number provided, will fall back to preceeding odd number
	 * Defaults to 7
	 */
	export let maxItems = 7;
	/**
	 * An array of link strings. This would normally be just a pathname without the domain.
	 */
	export let links: string[] = [];
	/**
	 * Currently selected item index (0 - based)
	 */
	export let currentItem: number = 0;
	/**
	 * Function fired when the nav button is clicked.
	 * @param {string} link pathname to reroute to
	 * @param {number} i index (not the label) of the clicked nav: `label = 2 --> i = 1`
	 */
	export let onPaginate: (link: string, i: number) => void = () => {};
	/**
	 * A svelte component to serve as (optional) wrapper around each button, e.g. Link component.
	 * Gets passed 'to' (as in: link to). If not provided falls back to a component rendering `<slot/>`
	 */
	export let Wrapper: typeof SvelteComponentDev = FallbackWrapper;

	// #region arrowButtons
	$: [prevItem, nextItem] = [currentItem - 1, currentItem + 1];
	$: [prevLink, nextLink] = [links[prevItem], links[nextItem]];
	// #endregion arrowButtons

	$: itemsToRender = getItemsToRender(links.length, maxItems, currentItem);
</script>

{#if !itemsToRender.length}
	{null}
{:else}
	<nav class={['flex', inputClasses].join(' ')}>
		<svelte:component this={Wrapper} to={prevLink}>
			<ArrowButton variant="left" disabled={!prevLink} on:click={() => onPaginate(prevLink, prevItem)} />
		</svelte:component>

		{#each itemsToRender as item}
			{#if item === null}
				<button disabled class={getButtonClasses('inactive')}>...</button>
			{:else}
				<svelte:component this={Wrapper} to={links[item]}>
					<button
						disabled={currentItem === item}
						class={getButtonClasses('hover', currentItem === item ? 'active' : 'inactive')}
						on:click={() => onPaginate(links[item], item)}
					>
						{item + 1}
					</button>
				</svelte:component>
			{/if}
		{/each}

		<svelte:component this={Wrapper} to={nextLink}>
			<ArrowButton variant="right" disabled={!nextLink} on:click={() => onPaginate(nextLink, nextItem)} />
		</svelte:component>
	</nav>
{/if}

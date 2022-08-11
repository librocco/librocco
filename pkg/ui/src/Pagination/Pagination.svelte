<script lang="ts">
	import ArrowButton from './ArrowButton.svelte';
	import FallbackWrapper from './FallbackWrapper.svelte';

	import { getItemsToRender } from './utils';
	import { getButtonClasses } from './styles';

	let inputClasses = '';
	export { inputClasses as class };
	export let maxItems = 7;
	export let links: string[] = [];
	export let currentItem: number = 0;
	export let onPaginate: (link: string, i: number) => void = () => {};
	export let Wrapper = FallbackWrapper;

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
			<ArrowButton
				variant="left"
				disabled={!prevLink}
				on:click={() => onPaginate(prevLink, prevItem)}
			/>
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
			<ArrowButton
				variant="right"
				disabled={!nextLink}
				on:click={() => onPaginate(nextLink, nextItem)}
			/>
		</svelte:component>
	</nav>
{/if}

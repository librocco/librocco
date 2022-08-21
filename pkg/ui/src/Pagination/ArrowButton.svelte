<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@librocco/svg';

	import { getButtonClasses } from './styles';

	export let disabled = false;
	export let variant: 'left' | 'right';

	const arrowIconLookup = {
		left: ChevronLeft,
		right: ChevronRight
	};
	const Icon = arrowIconLookup[variant];
</script>

<button class={getButtonClasses('inactive', disabled ? 'disabled' : 'hover')} {disabled} on:click>
	<span class="block w-6 h-6">
		<svelte:component this={Icon} />
	</span>
</button>

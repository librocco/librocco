<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

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
	<span class="block h-6 w-6">
		<svelte:component this={Icon} />
	</span>
</button>

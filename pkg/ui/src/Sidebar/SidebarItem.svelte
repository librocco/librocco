<script lang="ts">
	export let name: string;
	export let href: string;
	export let current = false;
	export let nested = false;

	$: borderClasses = current && !nested ? 'border-pink-600' : 'border-transparent';

	$: colourClasses = current
		? 'bg-pink-50 border-l-4 text-pink-600'
		: 'text-gray-600 group-hover:text-gray-900 group-hover:bg-white';

	const spacingClasses = nested ? 'pl-10 pr-2' : 'px-3';

	$: linkBaseClasses = [
		borderClasses,
		colourClasses,
		spacingClasses,
		'flex',
		'items-center',
		'py-3',
		'text-sm',
		'font-normal',
		'border-l-4',
		'gap-x-2'
	].join(' ');
</script>

<div class="group">
	<a on:click class={linkBaseClasses} {href}>
		{#if !nested && $$slots.default}
			<div class="h-5 w-5">
				<slot />
			</div>
		{/if}
		{name}
	</a>
</div>

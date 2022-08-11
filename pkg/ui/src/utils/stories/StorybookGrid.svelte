<script lang="ts">
	let className = '';
	export { className as class };
	export let cols = 5;

	// I find 5 cols the max sensible number of cols to display
	// if the provided number is 0 or higher than 5, default to 1
	$: colsToDisplay = !cols || cols > 5 ? 1 : cols;

	const colsClasses = [
		'',
		'grid-cols-1',
		'grid-cols-2',
		'grid-cols-3',
		'grid-cols-4',
		'grid-cols-5'
	];
</script>

<div class={['w-lg grid gap-y-12', colsClasses[colsToDisplay], className].join(' ')}>
	<slot />
</div>

<script lang="ts">
	export let tabName: string;
	export let selected: boolean;

	// TODO: Handle this
	$: href = 'javascript:void(0)'; // `#${name.replace(' ', '-')}`;

	$: linkTextClasses = selected ? 'text-gray-900' : 'text-gray-700 hover:text-gray-700';
	$: linkClasses = [
		linkTextClasses,
		'hidden',
		'sm:inline',
		'group',
		'relative',
		'min-w-0',
		'flex-1',
		'overflow-hidden',
		'bg-white',
		'p-4',
		'text-sm',
		'font-mmedium',
		'text-center',
		'hover:bg-gray-50',
		'focus:z-10'
	].join(' ');

	$: spanColourClasses = selected ? 'bg-teal-500' : 'bg-transparent';
	$: spanClasses = [spanColourClasses, 'absolute', 'inset-x-0', 'bottom-0', 'h-0.5'].join(' ');
</script>

<option class="sm:hidden" {selected}>{tabName}</option>

<a {href} on:click class={linkClasses} aria-current="page">
	<span>{tabName}</span>
	<span aria-hidden="true" class={spanClasses} />
</a>

<script lang="ts">
	export let tabName: string;
	export let selected: boolean;

	$: href = `#${tabName}`;

	$: linkTextClasses = selected ? 'bg-teal-500 text-gray-900' : 'text-white hover:text-teal-500';
	$: linkClasses = [linkTextClasses, 'px-3 py-2 font-medium text-sm rounded-md'].join(' ');
</script>

<option class="sm:hidden" {selected}>{tabName}</option>

<a {href} on:click class={linkClasses} aria-current={selected ? 'page' : 'false'}>
	<span>{tabName}</span>
</a>

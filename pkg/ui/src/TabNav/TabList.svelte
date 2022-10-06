<script lang="ts">
	import { getContext, onMount } from 'svelte';

	import { TABS, type TabContext } from './TabContext.svelte';
	import Tab from './Tab.svelte';

	export let tabNames: string[];
	export let initialTabIx = 0;
	export let ariaLabel = 'Select a tab';

	const { selectTab, registerTab, currentTab } = getContext<TabContext>(TABS);

	onMount(() => {
		tabNames.forEach((tab) => registerTab(tab));
		selectTab(tabNames[initialTabIx]);
	});

	const handleSelectOnChange = (e: Event) => {
		const target = e.target as HTMLSelectElement;
		selectTab(target.value);
	};

	const selectClasses = [
		'block',
		'w-full',
		'rounded-md',
		'border-gray-300',
		'focus:border-0',
		'focus:ring-0',
		'focus:outline-2',
		'focus:outline-teal-500'
	].join(' ');

	const navClasses = [
		'isolate',
		'flex',
		'divide-x',
		'divide-gray-200',
		'rounded-lg',
		'shadow'
	].join(' ');
</script>

<!-- Small screens = Select > Option (Tab.svelte) -->
<div class="sm:hidden">
	<label for="tabs" class="sr-only">{ariaLabel}</label>
	<select on:change={handleSelectOnChange} id="tabs" name="tabs" class={selectClasses}>
		{#each tabNames as tabName}
			<Tab {tabName} selected={tabName === $currentTab} />
		{/each}
	</select>
</div>
<!-- Med screens+ = Nav > A (Tab.svelte)  -->
<div class="hidden sm:block">
	<span id="tabs" class="sr-only">{ariaLabel}</span>
	<nav class={navClasses} aria-labelledby="tabs">
		{#each tabNames as tabName}
			<Tab {tabName} selected={tabName === $currentTab} on:click={() => selectTab(tabName)} />
		{/each}
	</nav>
</div>

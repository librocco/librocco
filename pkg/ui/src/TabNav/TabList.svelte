<script lang="ts">
	import { getContext } from 'svelte';
	import { TABS } from './Tabs.svelte';

	import Tab from './Tab.svelte';

	const { selectTab, selectedTab } = getContext(TABS);

	export let tabs: string[];

	// TODO: label & aria

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
	<label for="tabs" class="sr-only">Select a tab</label>
	<select on:change={handleSelectOnChange} id="tabs" name="tabs" class={selectClasses}>
		{#each tabs as tabName}
			<Tab {tabName} selected={tabName === $selectedTab} />
		{/each}
	</select>
</div>
<!-- Med screens+ = Nav > A (Tab.svelte)  -->
<div class="hidden sm:block">
	<nav class={navClasses} aria-label="Tabs">
		{#each tabs as tabName}
			<Tab {tabName} selected={tabName === $selectedTab} on:click={() => selectTab(tabName)} />
		{/each}
	</nav>
</div>

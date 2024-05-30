<script lang="ts">
	let className = "";
	export { className as class };

	export let title = "";
	export let description = "";

	const iconProps = {
		size: 36,
		class: "text-white"
	};
</script>

<div class="text-center {className}">
	{#if $$slots.icon}
		<div class="mx-auto mb-3 h-14 w-14 rounded-md bg-teal-500 p-2.5 text-center"><slot {iconProps} name="icon" /></div>
	{/if}
	<p class="text-xl font-semibold leading-7 text-gray-900">{title}</p>
	<p class="mb-3 text-base font-normal leading-7 text-gray-600">{description}</p>
	<slot />
</div>

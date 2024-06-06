<script>
	import Page from "$lib/components/Page.svelte";
</script>

<Page view="error" loaded={true}>
	<svelte:fragment slot="topbar">
		<div class="w-full p-5">
			<h1 class="text-2xl font-bold text-gray-800">Something crashed!</h1>
		</div>
	</svelte:fragment>
	<svelte:fragment slot="heading">
		<h2 class="mb-6 text-gray-500">Try checking your internet connection if you're using an online database.</h2>
	</svelte:fragment>
</Page>

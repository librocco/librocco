<script lang="ts">
	export let label = '';
</script>

<figure class="w-full h-24 flex flex-col items-stretch">
	<div class="w-full h-full flex justify-center items-center">
		<slot />
	</div>

	{#if label}
		<figcaption class="w-full text-center text-gray-600">
			{label}
		</figcaption>
	{/if}
</figure>

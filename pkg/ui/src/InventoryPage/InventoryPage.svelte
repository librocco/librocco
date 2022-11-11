<script>
	import { compute_slots } from 'svelte/internal';
</script>

<body class="flex h-screen flex-col">
	<slot name="header" />

	<main class="flex h-full divide-x divide-gray-300 border border-gray-300">
		{#if $$slots.sidebar}
			<section class="w-[280px] bg-gray-50">
				<slot name="sidebar" />
			</section>
		{/if}

		<section class="flex w-full flex-col">
			{#if $$slots.tableHeader}
				<div class="min-h-[100px] flex-shrink-0 p-10 pt-6">
					<slot name="tableHeader" />
				</div>
			{/if}

			{#if $$slots.table}
				<div class="h-full">
					<slot name="table" />
				</div>
			{/if}

			{#if $$slots.tableFooter}
				<div class="mt-auto min-h-[140px] p-10">
					<slot name="tableFooter" />
				</div>
			{/if}
		</section>
	</main>
</body>

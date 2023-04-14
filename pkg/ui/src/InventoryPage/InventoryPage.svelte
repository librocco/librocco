<div class="flex h-screen flex-col">
	<div class="basis-[5%]">
		<slot name="header" />
	</div>

	<main class="basis-[95%] flex divide-x divide-gray-300 items-stretch overflow-y-auto">
		{#if $$slots.sidebar}
			<section class="shrink-0 basis-32 sm:basis-56 h-full bg-gray-50 overflow-y-auto overflow-x-hidden whitespace-nowrap">
				<slot name="sidebar" />
			</section>
		{/if}

		<section class="w-full justify-start h-full flex gap-y-8 flex-col overflow-auto py-8">
			{#if $$slots.tableHeader}
				<div class="px-8">
					<slot name="tableHeader" />
				</div>
			{/if}

			{#if $$slots.table}
				<div class="grow">
					<slot name="table" />
				</div>
			{/if}

			{#if $$slots.tableFooter}
				<div class="px-8">
					<slot name="tableFooter" />
				</div>
			{/if}
		</section>
	</main>
</div>

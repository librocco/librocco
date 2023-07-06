<div class="flex h-screen flex-col">
	<div class="basis-[5%]">
		<slot name="header" />
	</div>

	<main class="flex basis-[95%] items-stretch divide-x divide-gray-300 overflow-y-auto">
		{#if $$slots.sidebar}
			<section
				id="sidebar-section"
				class="h-full shrink-0 basis-32 overflow-y-auto overflow-x-hidden whitespace-nowrap bg-gray-50 sm:basis-56"
			>
				<slot name="sidebar" />
			</section>
		{/if}

		<section id="table-section" class="flex h-full w-full flex-col justify-start gap-y-8 overflow-auto py-8">
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

	{#if $$slots.slideOver}
		<section id="slideover-section" class="h-autoshadow-lg fixed right-0">
			<slot name="slideOver" />
		</section>
	{/if}
</div>

<slot name="header" />

<main class="absolute top-[168px] left-0 right-0 bottom-0 flex divide-x divide-gray-300 border border-gray-300">
	<section class="w-[280px]">
		<slot name="sidebar" />
	</section>

	<section class="flex w-full flex-col">
		<div class="min-h-[140px] bg-gray-50 p-10 pt-6">
			<slot name="tableHeader" />
		</div>

		<div class="h-full">
			<slot name="table" />
		</div>

		<div class="mt-auto min-h-[140px] p-10">
			<slot name="tableFooter" />
		</div>
	</section>
</main>

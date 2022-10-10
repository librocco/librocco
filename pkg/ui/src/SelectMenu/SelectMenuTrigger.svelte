<script lang="ts">
	export let label = '';
</script>

<div>
	<div class="relative">
		<div class="inline-flex divide-x divide-indigo-600 rounded-md shadow-sm">
			<div class="inline-flex divide-x divide-indigo-600 rounded-md shadow-sm">
				<div
					class="inline-flex items-center rounded-l-md border border-transparent bg-indigo-500 py-2 pl-3 pr-4 text-white shadow-sm"
				>
					<!-- Heroicon name: mini/check -->
					<svg
						class="h-5 w-5"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
							clip-rule="evenodd"
						/>
					</svg>
					<p class="ml-2.5 text-sm font-medium">{label}</p>
				</div>
				<button
					type="button"
					class="inline-flex items-center rounded-l-none rounded-r-md bg-indigo-500 p-2 text-sm font-medium text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50"
					aria-haspopup="listbox"
					aria-expanded="true"
					aria-labelledby="listbox-label"
				>
					<span class="sr-only">Change published status</span>
					<!-- Heroicon name: mini/chevron-down -->
					<svg
						class="h-5 w-5 text-white"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>
		</div>
	</div>
</div>

<script lang="ts">
	import { Library } from "lucide-svelte";

	export let displayName: string;
	export let totalBooks = 0;
</script>

<li class="flex items-center justify-between py-4 px-6">
	<div class="max-w-1/2 w-full">
		<p class="mb-[5px] text-base font-semibold leading-6 text-gray-900">{displayName}</p>
		<p class="flex items-center gap-x-1">
			<Library class="text-gray-700" size={20} /><span class="text-sm font-normal leading-5 text-gray-500">{totalBooks} books</span>
		</p>
	</div>

	<div class="max-w-1/2 flex w-full items-center justify-between">
		<slot name="actions" />
	</div>
</li>

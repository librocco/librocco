<script lang="ts">
	import { QrCode } from "lucide-svelte";

	import { Button } from "$lib/components";

	import { scan } from "./action";

	export let onAdd: (isbn: string) => void | Promise<void> = () => {};

	let isbn = "";

	const handleSubmit = (cb: (isbn: string) => void | Promise<void>) => () => {
		cb(isbn);
		isbn = "";
	};
</script>

<form id="scan-input-container" on:submit|preventDefault={handleSubmit(onAdd)}>
	<div class="my-[2px]">
		<div class="mx-[2px] flex rounded-md shadow-sm outline outline-1 outline-gray-300 focus-within:outline-2 focus-within:outline-teal-500">
			<div class="flex items-center bg-white pr-0 pl-3 text-gray-400">
				<QrCode />
			</div>
			<input
				type="text"
				id="isbn"
				placeholder="Scan to add books..."
				aria-label="isbn"
				class="block w-full border-0 px-4 py-4 text-sm focus:outline-0 focus:ring-0"
				name="isbn"
				bind:value={isbn}
				use:scan
			/>
			<div class="flex items-center bg-white pl-1 pr-3 text-gray-400">
				<div class="flex gap-x-2">
					<Button type="submit" disabled={isbn === ""}>Add</Button>
				</div>
			</div>
		</div>
	</div>
</form>

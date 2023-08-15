<script lang="ts">
	import { createForm } from "felte";
	import { QrCode } from "lucide-svelte";
	import { onDestroy, onMount } from "svelte";

	import { Button } from "$lib/Button";

	export let onAdd: (isbn: string) => void | Promise<void> = () => {};

	const initialValues = { isbn: "" };

	const { form, data } = createForm({
		initialValues,
		onSubmit: async ({ isbn }, { reset }) => {
			await (async () => onAdd(isbn))();
			reset();
		}
	});

	let isbn = "";

	let inputElement: HTMLInputElement;
	const handleScan = (e: KeyboardEvent) => {
		// If focused on an input element, pass the input to the element
		if (e.target instanceof HTMLInputElement) return;

		if (/[0-9]/.test(e.key)) {
			// If numbered input, it passes as isbn input (likely from scan element)
			isbn += e.key;
			// Focus the scan element to appropriately handle enter key
			inputElement?.focus();
		}
	};
	onMount(() => {
		window.addEventListener("keydown", handleScan);
	});
	onDestroy(() => {
		window.removeEventListener("keydown", handleScan);
	});
</script>

<form id="scan-input-container" use:form>
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
				bind:this={inputElement}
			/>
			<div class="flex items-center bg-white pl-1 pr-3 text-gray-400">
				<div class="flex gap-x-2">
					<Button type="submit" disabled={!$data.isbn}>Add</Button>
				</div>
			</div>
		</div>
	</div>
</form>

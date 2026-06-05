<script lang="ts">
	export let rowIx: number;
	export let quantity: number;

	let form: HTMLFormElement | null;
	let originalValue = quantity;

	const handleFocus = () => {
		originalValue = quantity;
	};

	const handleBlur = (e: FocusEvent) => {
		const input = e.currentTarget as HTMLInputElement;
		const nextValue = input.valueAsNumber;
		// Invalid blur (cleared field, value below min) reverts to the original — mirrors
		// the Escape path so the DOM never gets stuck showing a value that won't commit.
		if (Number.isNaN(nextValue) || !input.checkValidity()) {
			input.value = String(originalValue);
			return;
		}
		if (nextValue === originalValue) return;
		form?.requestSubmit();
	};

	const handleKeydown = (e: KeyboardEvent) => {
		const input = e.currentTarget as HTMLInputElement;
		if (e.key === "Escape") {
			input.value = String(originalValue);
			input.blur();
			return;
		}
		// Enter triggers implicit form submission. Sync originalValue so a subsequent blur
		// (e.g. from user clicking elsewhere after pressing Enter) doesn't double-commit.
		if (e.key === "Enter" && input.checkValidity()) {
			originalValue = input.valueAsNumber;
		}
	};
</script>

<form method="POST" id="row-{rowIx}-quantity-form" on:submit|preventDefault bind:this={form}>
	<input
		name="quantity"
		id="quantity"
		value={quantity}
		data-value={quantity}
		class="border-base w-full rounded border bg-transparent px-2 py-1.5 text-center focus:border-primary focus:bg-base-200 focus:outline-none focus:ring-2 focus:ring-primary"
		type="number"
		min="1"
		required
		on:focus={handleFocus}
		on:blur={handleBlur}
		on:keydown={handleKeydown}
	/>
</form>

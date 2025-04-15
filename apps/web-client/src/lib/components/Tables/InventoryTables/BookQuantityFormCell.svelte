<script lang="ts">
	export let rowIx: number;
	export let quantity: number;

	let form: HTMLFormElement | null;
</script>

<form method="POST" id="row-{rowIx}-quantity-form" on:submit|preventDefault bind:this={form}>
	<input
		name="quantity"
		id="quantity"
		value={quantity}
		class="border-base focus:border-primary w-full rounded border bg-transparent px-2 py-1.5 text-center focus:ring-0"
		type="number"
		min="1"
		required
		on:blur={() => form.requestSubmit()}
	/>
</form>

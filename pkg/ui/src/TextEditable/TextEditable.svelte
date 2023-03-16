<script lang="ts">
	import { tick } from 'svelte';
	import { Pencil, Check, X } from 'lucide-svelte';

	/**
	 * This is the exposed 'value' of the text/input element. This value accepts updates from the parent component, while
	 * the internal, display value is updated when the input is saved. This results in the following behaviour:
	 * - parent component binds to this value
	 * - the parent component updates the 'value' and the udpate is immediately visible in the input
	 * - the user edits the input - no change is propagated to the parent component
	 * - the user saves the input - the parent component is updated with the new value
	 */
	export let value = '';

	let input: HTMLElement;

	/** This is the internal value, used to store the current state of the input */
	$: text = value;
	export let isEditing = false;

	export let disabled = false;

	/** Enter edit mode */
	function edit() {
		// Noop if disabled
		if (disabled) {
			return;
		}
		isEditing = true;
		tick().then(() => input.focus());
	}
	/** Reset the input to the original value */
	function reset() {
		text = value;
		isEditing = false;
	}
	/** Save the input and propagate the new value to the parent component */
	function save() {
		if (value != text) {
			value = text;
		}
		isEditing = false;
	}
</script>

<div {...$$restProps}>
	{#if !isEditing}
		<p
			on:click={edit}
			on:keydown
			class="group relative inline-block h-[38px] pt-4 pr-8 {disabled ? 'cursor-normal' : 'cursor-pointer'}"
			on:focus={edit}
		>
			<span class="inline-block align-middle text-lg font-medium leading-6">{text}</span>
			{#if !disabled}
				<button
					class="absolute top-0 right-0 hidden h-10 w-10 -translate-y-1/4 p-2 group-hover:block"
					on:click={edit}
				>
					<Pencil class="h-4 w-4 text-cyan-700" />
				</button>
			{/if}
		</p>
	{:else}
		<div class="flex w-[400px] items-center gap-1  border-b-2 border-cyan-700">
			<input
				class="h-[38px] w-full p-2 text-lg font-medium leading-6 focus:outline-none"
				bind:this={input}
				bind:value={text}
				on:keydown={(e) => (e.key === 'Enter' ? save() : e.key === 'Escape' ? reset() : null)}
				on:change
			/>
			<button on:click={reset} class="h-8 w-8 flex-shrink-0 p-1"><X class="h-6 w-6 text-red-400" /></button>
			<button on:click={save} class="h-8 w-8 flex-shrink-0 p-1"><Check class="h-6 w-6 text-green-400" /></button>
		</div>
	{/if}
</div>

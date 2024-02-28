<script lang="ts">
	import { tick } from "svelte";
	import { PencilLine } from "lucide-svelte";
	import { clickOutside } from "$lib/actions";

	export let name: string;
	export let id: string = name;

	/**
	 * This is the exposed 'value' of the text/input element. This value accepts updates from the parent component, while
	 * the internal, display value is updated when the input is saved. This results in the following behaviour:
	 * - parent component binds to this value
	 * - the parent component updates the 'value' and the udpate is immediately visible in the input
	 * - the user edits the input - no change is propagated to the parent component
	 * - the user saves the input - the parent component is updated with the new value
	 */
	export let value = "";
	export let placeholder = "Untitled";
	export let isEditing = false;
	export let disabled = false;
	export let input: HTMLElement | null = null;

	export let textEl: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" = "p";
	export let textClassName: string = "text-base font-normal";

	/** This is the internal value, used to store the current state of the input */
	$: text = value;

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

<div
	class="relative block w-full rounded border-2 border-transparent bg-transparent p-2 delay-75 focus-within:border-gray-500 focus-within:bg-gray-50 hover:border-gray-500"
	use:clickOutside
	on:clickoutside={save}
>
	{#if isEditing}
		<div
			class="absolute z-10 flex w-full flex-row items-center justify-between gap-x-2 transition-opacity duration-75
			{isEditing ? 'visible opacity-100' : 'invisible opacity-0'}"
		>
			<input
				type="text"
				class="min-w-0 grow border-0 bg-transparent p-0 text-gray-800 placeholder-gray-400 focus:border-transparent focus:ring-0 {textClassName}"
				{placeholder}
				{name}
				{id}
				bind:this={input}
				bind:value={text}
				on:keydown={(e) => (e.key === "Enter" ? save() : e.key === "Escape" ? reset() : null)}
				on:change
			/>
		</div>
	{/if}
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="flex flex-row items-center gap-x-2
		{isEditing ? 'invisible' : 'visible'}
		{text === '' || disabled ? 'text-gray-400' : 'text-gray-800'}"
		class:cursor-pointer={!disabled}
		role="textbox"
		aria-label="Edit {name}"
		tabindex="0"
		on:keydown
		on:click={edit}
		on:focus={edit}
	>
		<svelte:element this={textEl} class="{placeholder === '' && !text ? 'hidden' : 'truncate'} {textClassName}">
			{text === "" ? placeholder : text}
		</svelte:element>
		{#if !disabled}
			<span class="text-gray-500" aria-hidden>
				<PencilLine size={20} />
			</span>
		{/if}
	</div>
</div>

<!-- svelte-ignore css-unused-selector -->
<style>
	/* trick to maintain textnode height when its empty https://stackoverflow.com/a/66457550 */
	p:empty::before,
	h1:empty::before,
	h2:empty::before,
	h3:empty::before h4:empty::before h5:empty::before h6:empty::before {
		content: "";
		display: inline-block;
	}
</style>

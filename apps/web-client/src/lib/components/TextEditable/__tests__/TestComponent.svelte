<script lang="ts">
	import TextEditable from "../TextEditable.svelte";

	let value = "";
	export let isEditing: boolean;
</script>

<input name="other input" bind:value />
<TextEditable name="text" bind:isEditing bind:value />

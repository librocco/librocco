<script lang="ts">
	import TextEditable from "../TextEditable.svelte";

	let value = "";
	export let isEditing: boolean;
</script>

<input bind:value />
<TextEditable bind:isEditing bind:value />

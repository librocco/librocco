<script lang="ts">
	import { onMount } from "svelte";
	import { getDB } from "./db";

	onMount(async () => {
		const db = getDB();
		await db.init();
		window["db"] = db;
	});

	let msg = "gg";
</script>

<h1>{msg}</h1>

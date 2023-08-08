<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import BookDetailForm from "./BookDetailForm.svelte";

	export let Hst: Hst;

	const publisherList = ["TCK Publishing", "Reed Elsevier", "Penguin Random House", "Harper Collins", "Bloomsbury"];
</script>

<Hst.Story title="Forms / BookDetailForm" layout={{ type: "grid", width: 600 }}>
	<BookDetailForm
		book={{
			isbn: "819200012",
			title: "A brief history of the cosmos and essential kitchen appliances",
			price: 15,
			authors: "Stephen Hawking, Bill Bryson",
			publisher: "Penguin",
			editedBy: "Anonymous",
			outOfPrint: true
		}}
		mode="edit"
		on:create={() => alert("create")}
		on:edit={() => alert("edit")}
		{publisherList}
	/>
</Hst.Story>

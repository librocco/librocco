<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import BookDetailForm from "./BookDetailForm.svelte";

	export let Hst: Hst;

	const book = {
		isbn: "",
		title: "",
		authors: "",
		publisher: "",
		year: "",
		price: 0
	};

	const publisherList = ["TCK Publishing", "Reed Elsevier", "Penguin Random House", "Harper Collins", "Bloomsbury"];
</script>

<Hst.Story title="Forms / BookDetailForm" layout={{ type: "grid", width: 600 }}>
	<BookDetailForm {book} {publisherList} />
</Hst.Story>

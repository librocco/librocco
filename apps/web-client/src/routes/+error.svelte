<!-- src/routes/+error.svelte -->
<script lang="ts">
	import { get } from "svelte/store";
	import { page } from "$app/state";

	import { clientError } from "$lib/stores/errors";

	export let source;
	export let message;

	if (get(clientError)) {
		source = "client side error";
		const err = get(clientError);
		message = err.message;

		// Clear the error after displaying it
		clientError.set(null);
	} else if (page.error) {
		source = "load time error";
		message = page.error.message;
	}

	function formatErrMsg(msg: string) {
		// return msg;
		return msg
			.split("\n")
			.filter(Boolean)
			.filter((l) => !l.trim().startsWith("at "))
			.filter((l) => !l.trim().startsWith("in "));
	}
</script>

<div class="relative h-full w-full overflow-y-auto overflow-x-hidden">
	<div class="absolute left-1/2 top-1/2 w-[80%] -translate-x-1/2 -translate-y-1/2 p-8 text-center">
		<h1>⚠️ Oops! Something went wrong.</h1>

		<div class="w-full text-left">
			<p class="my-8"><strong>Source:</strong> {source}</p>
			<p class="mt-8"><strong>Message:</strong> {formatErrMsg(message)}</p>
		</div>
	</div>
</div>

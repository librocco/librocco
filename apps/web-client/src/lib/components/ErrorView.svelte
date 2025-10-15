<script lang="ts">
	export let source: "load" | "runtime";
	export let message: string;

	/** Removes the trace embedded in */
	function formatErrMsg(msg: string) {
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

		{#if source === "runtime"}
			<button on:click={() => window.location.reload()} class="btn-primary btn">Reload</button>
		{/if}
	</div>
</div>

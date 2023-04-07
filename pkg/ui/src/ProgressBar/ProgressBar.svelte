<script lang="ts">
	/** Progress status, a number between 0 and 1 */
	export let value: number | undefined = undefined;

	$: progressWidth = value !== undefined ? `${value * 100}%` : undefined;
</script>

<div {...$$restProps} class="relative h-px w-52 bg-sky-700 {$$restProps.class}">
	<div class="absolute -left-0.5 -top-0.5 -bottom-0.5 -right-0.5 overflow-hidden rounded">
		{#if progressWidth}
			<div class="absolute top-0 left-0 h-full animate-pulse overflow-hidden rounded bg-teal-700" style:width={progressWidth} />
			<div class="absolute top-0 left-0 h-full animate-pulse overflow-hidden rounded bg-teal-500" style:width={progressWidth} />
		{:else}
			<div class="animate-unknown absolute top-0 left-1/2 h-full w-[60%] overflow-hidden rounded bg-teal-700" />
			<div class="animate-unknown absolute top-0 left-1/2 h-full w-[60%] overflow-hidden rounded bg-teal-500" />
		{/if}
	</div>
</div>

<style>
	@keyframes loader {
		0% {
			transform: translateX(-175%);
		}
		100% {
			transform: translateX(75%);
		}
	}

	.animate-unknown {
		animation: loader 0.9s alternate infinite ease-in-out, pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>

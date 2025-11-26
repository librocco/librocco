<script lang="ts" generics="T">
	import { onMount } from "svelte";
	import type { AsyncData } from "$lib/types/async-data";
	import { resolveAsyncData, isLoaded } from "$lib/types/async-data";

	export let data: AsyncData<T>;
</script>

{#if data === null}
	<slot name="ssr" />
{:else if isLoaded(data)}
	<slot resolved={data} />
{:else}
	{#await data}
		<slot name="loading">
			<div class="flex grow justify-center">
				<div class="mx-auto translate-y-1/2">
					<span class="loading loading-spinner loading-lg text-primary"></span>
				</div>
			</div>
		</slot>
	{:then resolved}
		<slot {resolved} />
	{:catch error}
		<slot name="error" {error}>
			<div class="alert alert-error">
				<span>Error loading data: {error.message}</span>
			</div>
		</slot>
	{/await}
{/if}

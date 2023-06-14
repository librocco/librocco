<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import Toast from "./Toast.svelte";
	import { ToastType } from "./enums";

	import { createToaster } from "../Toasts/index";

	export let Hst: Hst;

	const toaster = createToaster();

	const toastCore = {
		duration: 2000,
		pausable: true
	};

	const successToast = {
		message: "Note updated",
		type: ToastType.Success,
		...toastCore
	};

	const errorToast = {
		message: "Something went wrong. Please try again",
		type: ToastType.Error,
		...toastCore
	};
</script>

<Hst.Story title="Toast" layout={{ type: "grid", width: 500 }}>
	<div class="m-4 flex flex-col gap-y-6">
		{#each $toaster as toast (toast.id)}
			<Toast {toast} />
		{/each}
	</div>
	<div class="flex gap-x-2">
		<button class="rounded bg-green-100 p-3" on:click={() => toaster.push(successToast)}>Toast Success :)</button>
		<button class="rounded bg-red-100 p-3" on:click={() => toaster.push(errorToast)}>Toast Error :(</button>
	</div>
</Hst.Story>

<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import { Toast, type ToastData, ToastType } from "./";
	import { createToaster } from "../Toasts";

	export let Hst: Hst;

	/**
	 * Originally I was using context to share the toasterStore between producer and consumer
	 * but updated this to a map so that toasters could be created outside of components...
	 *
	 * This broke the original version of this story, which had dummy buttons and toasts to
	 * simulate toast action. There is an error with Histoire and all I could gather quickly is
	 * that it is proxying data to the component and it cannot clone the toaster function stored in the map properly.
	 *
	 * The tests still pass and the functionality still works in the app, so I have reduced this story to a dumb
	 * rendering of Toasts: they will not timeout and cannot be closed... but still, they require a toasterStore to
	 * render properly, so we call...
	 */
	createToaster<ToastData>();

	const toastCore = {
		id: "1-1",
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

	const warnToast = {
		message: "Caution!",
		type: ToastType.Warning,
		...toastCore
	};
</script>

<Hst.Story title="Toast" layout={{ type: "grid", width: 500 }}>
	<div class="m-4 flex flex-col gap-y-6">
		<Toast toast={successToast} />
		<Toast toast={errorToast} />
		<Toast toast={warnToast} />
	</div>
</Hst.Story>

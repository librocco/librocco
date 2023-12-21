<script lang="ts">
	import { type createDialog, melt } from "@melt-ui/svelte";

	export let dialog: ReturnType<typeof createDialog>;
	export let onConfirm: (closeDialog: () => void) => void = () => {};

	const {
		elements: { content, title, description, close },
		states: { open }
	} = dialog;

	const closeDialog = () => open.set(false);
</script>

<div
	class="fixed left-[50%] top-[50%] z-50 mx-auto flex min-w-min max-w-2xl translate-x-[-50%] translate-y-[-50%] flex-col gap-y-6 bg-white py-8 px-4"
	use:melt={$content}
>
	<slot name="content">
		<div class="flex w-full grow flex-col items-start gap-y-6">
			<div class="flex flex-col gap-y-3">
				<h2 class="text-lg font-semibold text-gray-800" use:melt={$title}>
					<slot name="title" />
				</h2>
				<p class="text-base font-normal text-gray-800" use:melt={$description}>
					<slot name="description" />
				</p>
			</div>
		</div>
	</slot>

	<div class="border-t-1 flex gap-x-4 self-end">
		<div>
			<button class="button button-white" use:melt={$close} type="button">
				<span class="button-text"> Cancel </span>
			</button>
		</div>
		<div>
			<slot name="confirm-button">
				<button class="button button-green" type="button" on:click={() => onConfirm(closeDialog)}>
					<span class="button-text"> Confirm </span>
				</button>
			</slot>
		</div>
	</div>
</div>

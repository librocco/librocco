<script lang="ts">
	import { type createDialog, melt } from "@melt-ui/svelte";

	export let type: "commit" | "delete";
	export let dialog: ReturnType<typeof createDialog>;
	export let onConfirm: (closeDialog: () => void) => void = () => {};

	const {
		elements: { content, title, description, close },
		states: { open }
	} = dialog;

	const closeDialog = () => open.set(false);
</script>

<div
	class="flex max-w-fit flex-col gap-y-8 rounded-md py-6 px-4 
	{type === 'commit' ? 'bg-white' : 'bg-rose-100'}"
	use:melt={$content}
>
	<slot name="content">
		<div class="flex max-w-lg grow flex-col items-start gap-y-2">
			<h2 class="text-lg font-semibold text-gray-800" use:melt={$title}>
				<slot name="title" />
			</h2>
			<p class="whitespace-pre-line text-base font-normal text-gray-600" use:melt={$description}>
				<slot name="description" />
			</p>

			<slot />
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
				<button class="button {type === 'commit' ? 'button-green' : 'button-red'}" type="button" on:click={() => onConfirm(closeDialog)}>
					<span class="button-text"> Confirm </span>
				</button>
			</slot>
		</div>
	</div>
</div>

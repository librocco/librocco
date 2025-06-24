<script lang="ts">
	import { type createDialog, melt } from "@melt-ui/svelte";

	import LL from "@librocco/shared/i18n-svelte";

	export let type: "commit" | "delete";
	export let dialog: ReturnType<typeof createDialog>;
	export let onConfirm: (closeDialog: () => void) => void = () => {};
	export let onCancel: (closeDialog: () => void) => void = () => {};

	const {
		elements: { content, title, description, close },
		states: { open }
	} = dialog;

	const closeDialog = () => open.set(false);

	$: tCommon = $LL.common;
</script>

<div class="modal-box flex max-w-fit flex-col gap-y-4 rounded-md" use:melt={$content}>
	<slot name="content">
		<div class="flex max-w-lg grow flex-col items-start gap-y-2 p-3">
			<h2 class="text-lg font-semibold" use:melt={$title}>
				<slot name="title" />
			</h2>
			<p class="whitespace-pre-line text-base font-normal" use:melt={$description}>
				<slot name="description" />
			</p>

			<slot />
		</div>
	</slot>

	<div class="flex w-full justify-end gap-x-2 p-3">
		<div>
			<slot name="secondary-button">
				<button class="btn-secondary btn-outline btn" use:melt={$close} type="button" on:click={() => onCancel(closeDialog)}>
					<span class="button-text"> {tCommon.actions.cancel()} </span>
				</button>
			</slot>
		</div>
		<div>
			<slot name="confirm-button">
				<button class="btn {type === 'commit' ? 'btn-primary' : 'btn-error'}" type="button" on:click={() => onConfirm(closeDialog)}>
					{tCommon.actions.confirm()}
				</button>
			</slot>
		</div>
	</div>
</div>

<script lang="ts" context="module">
	export type ToastData = {
		title: string;
		description: string;
		detail?: string;
		style: "success" | "error";
	};

	const {
		elements: { content, title, description, close },
		helpers,
		states: { toasts },
		actions: { portal }
	} = createToaster<ToastData>({
		closeDelay: 2000
	});

	export const addToast = helpers.addToast;

	export const toastError = ({ title, description, detail }: Omit<ToastData, "style">) => {
		addToast({
			data: {
				title,
				description,
				style: "error",
				detail
			}
		});
	};

	const styleMap = {
		error: "bg-error text-error-content",
		success: "bg-success text-success-content"
	};
</script>

<script lang="ts">
	import { flip } from "svelte/animate";
	import { fly } from "svelte/transition";
	import { X } from "lucide-svelte";

	import { createToaster, melt } from "@melt-ui/svelte";
</script>

<div use:portal class="fixed bottom-0 right-0 z-[999] m-4 flex flex-col items-end gap-2 md:bottom-0">
	{#each $toasts as { id, data } (id)}
		<div
			class="flex w-96 items-center justify-between gap-x-4 rounded-lg shadow-lg {styleMap[data.style]}"
			use:melt={$content(id)}
			animate:flip={{ duration: 500 }}
			in:fly={{ duration: 150, x: "100%" }}
			out:fly={{ duration: 150, x: "100%" }}
		>
			<div class="relative flex w-[24rem] max-w-[calc(100vw-2rem)] items-center justify-between px-4 py-3">
				<div>
					<p use:melt={$title(id)} class="flex items-center gap-2 font-semibold">
						{data.title}
					</p>

					{#if data.detail}
						<details class="text-left" use:melt={$description(id)}>
							<summary class="text-base">{data.description}</summary>

							<span class="pl-4 text-xs">
								{data.detail}
							</span>
						</details>
					{:else}
						<p class="text-left text-base" use:melt={$description(id)}>
							{data.description}
						</p>
					{/if}
				</div>
				<button
					class="text-oyster-500 hover:text-oyster-500/50 focus:outline-cherry rounded-lg p-1 focus:outline-none focus:outline-offset-0"
					use:melt={$close(id)}
					aria-label="close notification"
				>
					<span aria-hidden>
						<X />
					</span>
				</button>
			</div>
		</div>
	{/each}
</div>

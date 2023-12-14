<script lang="ts">
	import { Plus, Search, Trash } from "lucide-svelte";

	import { EntityListRow, Page, PlaceholderBox } from "$lib/components";

	import EntityList from "$lib/components/EntityList/EntityList.svelte";
	import { Badge, BadgeColor } from "@librocco/ui/Badge";
	import { generateUpdatedAtString } from "$lib/utils/time";

	import { PROTO_PATHS } from "$lib/paths";

	interface Note {
		id: string;
		displayName?: string;
		updatedAt?: Date;
		totalBooks?: number;
	}
	const notes: Note[] = [
		{
			id: "note-1",
			displayName: "New Note",
			updatedAt: new Date(),
			totalBooks: 0
		},
		{
			id: "note-2",
			displayName: "New Note (2)"
		},
		{
			id: "note-3",
			updatedAt: new Date(),
			totalBooks: 3
		}
	];
</script>

<Page>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="flex w-full items-center justify-between">
			<h1 class="text-2xl font-bold leading-7 text-gray-900">Outbound</h1>
			<button class="flex items-center gap-2 rounded-md border border-gray-300 bg-white py-[9px] pl-[15px] pr-[17px]">
				<span><Plus size={20} /></span>
				<span class="text-sm font-medium leading-5 text-gray-700">New note</span>
			</button>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if !notes.length}
			<PlaceholderBox title="No open notes" description="Get started by adding a new note" class="center-absolute">
				<button class="mx-auto flex items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
					><span class="text-green-50">New note</span></button
				>
			</PlaceholderBox>
		{:else}
			<EntityList>
				{#each notes as note}
					{@const displayName = note.displayName || note.id}
					{@const updatedAt = note.updatedAt || undefined}
					{@const href = `${PROTO_PATHS.OUTBOUND}/${note.id}`}

					<EntityListRow {...note} {displayName}>
						<svelte:fragment slot="actions">
							{#if updatedAt}
								<Badge label="Last updated: {generateUpdatedAtString(updatedAt)}" color={BadgeColor.Success} />
							{:else}
								<!-- Inside 'flex justify-between' container, we want the following box (buttons) to be pushed to the end, even if there's no badge -->
								<div />
							{/if}

							<div class="flex items-center justify-end gap-3">
								<a {href} class="rounded-md bg-pink-50 px-[17px] py-[9px]"
									><span class="text-sm font-medium leading-5 text-pink-700">Edit</span></a
								>
								<button class="rounded-md border border-gray-300 bg-white py-[9px] pl-[17px] pr-[15px]"
									><Trash class="border-gray-500" size={20} /></button
								>
							</div>
						</svelte:fragment>
					</EntityListRow>
				{/each}
			</EntityList>
		{/if}
	</svelte:fragment>
</Page>

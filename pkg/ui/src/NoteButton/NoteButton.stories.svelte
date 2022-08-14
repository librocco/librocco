<script lang="ts">
	import { Meta, Story } from '@storybook/addon-svelte-csf';
	import { StorybookItem, StorybookGrid } from '../utils/stories';
	import { NoteButtonLabel, NoteButtonType } from './enums';

	import NoteButton from './NoteButton.svelte';
</script>

<Meta title="Components: NoteButton" />

<Story name="Note Button">
	<StorybookGrid>
		<StorybookItem label={`Type: Note In`}>
			<NoteButton />
		</StorybookItem>
		<StorybookItem label={`Type: Note Out`}>
			<NoteButton type={NoteButtonType.Out} />
		</StorybookItem>
		<StorybookItem label={`Type: Remove Books`}>
			<NoteButton type={NoteButtonType.Out} label={NoteButtonLabel.RemoveBooks} />
		</StorybookItem>
	</StorybookGrid>
</Story>

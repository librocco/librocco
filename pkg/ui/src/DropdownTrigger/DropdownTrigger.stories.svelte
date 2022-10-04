<script lang="ts">
	import { Meta, Story } from '@storybook/addon-svelte-csf';
	import { StorybookItem, StorybookGrid } from '../utils/stories';

	import { ChevronLeft } from '@librocco/svg';

	import DropdownTrigger from './DropdownTrigger.svelte';
</script>

<Meta title="Components: DropdownTrigger" />

<Story name="Dropdown Trigger">
	<StorybookGrid>
		<StorybookItem>
			<DropdownTrigger Icon={ChevronLeft} label="Options" />
		</StorybookItem>
	</StorybookGrid>
</Story>

<script lang="ts">
	import { Meta, Story, Template } from '@storybook/addon-svelte-csf';

	import { BadgeColor, BadgeSize } from './enums';

	import Badge from './Badge.svelte';

	import { StorybookItem, StorybookGrid } from '../utils/stories';
</script>

<Meta title="Components: Badge" />

<Story name="Shapes And Sizes">
	<h1 class="text-lg font-bold mb-4">Sizes:</h1>
	<StorybookGrid class="mb-16">
		{#each Object.values(BadgeSize) as size}
			<StorybookItem label={`Size: ${size}`}>
				<Badge {...{ size }}>{size}</Badge>
			</StorybookItem>
		{/each}
	</StorybookGrid>
	<h1 class="text-lg font-bold mb-4">Colors:</h1>
	<StorybookGrid class="mb-16">
		{#each Object.values(BadgeColor) as color}
			<StorybookItem label={`Color: ${color}`}>
				<Badge {...{ color }} />
			</StorybookItem>
		{/each}
	</StorybookGrid>
</Story>

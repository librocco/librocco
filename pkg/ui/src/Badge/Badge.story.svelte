<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { BadgeColor, BadgeSize } from './enums';
	import Badge from './Badge.svelte';

	export let Hst: Hst;
</script>

<Hst.Story title="Badge" layout={{ type: 'grid' }}>
	<Hst.Variant title="Sizes">
		{#each Object.values(BadgeSize) as size}
			<div class="p-2">
				<Badge {size} label={size} />
			</div>
		{/each}
	</Hst.Variant>

	<Hst.Variant title="Colors">
		{#each Object.values(BadgeColor) as color}
			<div class="p-2">
				<Badge {color} label={color} />
			</div>
		{/each}
	</Hst.Variant>
</Hst.Story>

<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { Mail } from 'lucide-svelte';

	import SideNavButton from './SideNavButton.svelte';

	export let Hst: Hst;
</script>

<Hst.Story title="Side Navigation: Button" layout={{ type: 'grid', width: 300 }}>
	<Hst.Variant title="Inactive">
		<SideNavButton>
			<Mail />
		</SideNavButton>
	</Hst.Variant>
	<Hst.Variant title="Selected">
		<SideNavButton selected>
			<Mail />
		</SideNavButton>
	</Hst.Variant>
</Hst.Story>

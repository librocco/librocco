<script lang="ts">
	import { ChevronRight } from "lucide-svelte";

	export let link: string;
	export let label: string;
	export let style: "gray" | "yellow";

	const className = {
		gray: "text-gray-600 hover:text-gray-900",
		yellow: "text-yellow-600 hover:text-yellow-900"
	};
</script>

<a href={link} class="inline-flex items-center gap-x-1 hover:underline {className[style]}">
	{label}
	<ChevronRight size={18} />
</a>

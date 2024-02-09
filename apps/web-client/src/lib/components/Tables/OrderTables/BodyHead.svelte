<script lang="ts">
	export let borderStyle: "yellow" | "gray";

	const className = {
		gray: "bg-gray-200",
		yellow: "bg-yellow-200"
	};
</script>

<div class="flex h-full items-center gap-x-2">
	<div class="w-2 self-stretch rounded-md {className[borderStyle]}" />
	<slot />
</div>

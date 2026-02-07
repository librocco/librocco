<script lang="ts">
	export let variant: "default" | "naked" = "default";
	export let selected: boolean = false;
	export let className: string = "";
</script>

<tr
	class="{variant === 'default'
		? 'border-b border-[#E5E5E5] transition-colors last:border-b-0 hover:bg-[#FAFAFA]' + (selected ? ' bg-[#FAFAFA]' : '')
		: ''} px-4 py-2 {className}"
>
	<slot />
</tr>

<script lang="ts">
	export let variant: "default" | "naked" = "default";
	export let selected: boolean = false;
	export let className: string = "";
</script>

<tr
	class="{variant === 'default'
		? 'border-b border-base-300 transition-colors last:border-b-0 hover:bg-base-200/60' + (selected ? ' bg-base-200/60' : '')
		: ''} px-4 py-2 {className}"
>
	<slot />
</tr>

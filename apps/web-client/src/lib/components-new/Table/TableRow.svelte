<script lang="ts">
	export let selected: boolean = false;
	export let className: string = "";
</script>

<tr
	class="border-b border-[#E5E5E5] px-[16px] py-[8px] transition-colors last:border-b-0 hover:bg-[#FAFAFA] {selected
		? 'bg-[#FAFAFA]'
		: ''} {className}"
>
	<slot />
</tr>

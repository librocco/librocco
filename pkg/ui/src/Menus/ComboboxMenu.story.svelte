<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";
	import { createCombobox } from "svelte-headlessui";
	import { ChevronsUpDown } from "lucide-svelte";

	import ComboboxMenu from "./ComboboxMenu.svelte";
	import { TextField } from "../FormFields";

	export let Hst: Hst;

	const options = ["TCK Publishing", "Reed Elsevier", "Penguin Random House", "Harper Collins", "Bloomsbury"];

	const combobox = createCombobox({ label: "Test combobox", expanded: true });
</script>

<Hst.Story title="Menus / Combobox" layout={{ type: "grid", width: 600 }}>
	<div class="relative m-2 h-72 w-4/6">
		<TextField name="publisher" label="Publisher" inputAction={combobox.input} value={$combobox.selected}>
			<div slot="endAdornment">
				<button use:combobox.button type="button" class="flex items-center">
					<ChevronsUpDown class="text-gray-400" />
				</button>
			</div>
		</TextField>
		<ComboboxMenu {combobox} {options} />
	</div>
</Hst.Story>

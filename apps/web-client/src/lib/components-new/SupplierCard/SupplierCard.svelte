<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { Hash, Mail, MapPin, Download, Trash2 } from "lucide-svelte";
	import LL from "@librocco/shared/i18n-svelte";

	export let name = "";
	export let id = "";
	export let email = "";
	export let address = "";
	export let orderFormat = "";

	const dispatch = createEventDispatcher();

	function handleEdit() {
		dispatch("edit");
	}

	function handleDelete() {
		dispatch("delete");
	}
</script>

<div class="space-y-4">
	<div class="mb-5">
		<h2 class="text-xl font-bold">{name}</h2>
	</div>

	<dl class="space-y-3">
		<div class="flex items-start gap-3 py-1">
			<dt class="sr-only">{$LL.suppliers_page.card.supplier_id()}</dt>
			<dd class="flex flex-1 items-start gap-3 text-sm">
				<Hash aria-hidden="true" class="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
				<span class="flex-1">{id.replace(/^#/, "")}</span>
			</dd>
		</div>

		<div class="flex items-start gap-3 py-1">
			<dt class="sr-only">{$LL.suppliers_page.card.email()}</dt>
			<dd class="flex flex-1 items-start gap-3 text-sm">
				<Mail aria-hidden="true" class="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
				<span class="flex-1">{email}</span>
			</dd>
		</div>

		<div class="flex items-start gap-3 py-1">
			<dt class="sr-only">{$LL.suppliers_page.card.address()}</dt>
			<dd class="flex flex-1 items-start gap-3 text-sm">
				<MapPin aria-hidden="true" class="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
				<span class="flex-1">{address}</span>
			</dd>
		</div>

		<div class="flex items-start gap-3 py-1">
			<dt class="sr-only">{$LL.suppliers_page.card.order_format()}</dt>
			<dd class="flex flex-1 items-start gap-3 text-sm">
				<Download aria-hidden="true" class="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
				<span class="flex-1">{orderFormat}</span>
			</dd>
		</div>
	</dl>

	<div class="pt-1">
		<button
			data-slot="button"
			class="[&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-background text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 has-[>_svg]:px-3 hover:text-accent-foreground inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 py-2 text-sm font-medium outline-none transition-all hover:bg-accent focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0"
			onclick={handleEdit}
		>
			{$LL.suppliers_page.card.edit_details()}
		</button>
	</div>

	<div class="border-t border-gray-200 pt-4"></div>

	<div>
		<button
			data-slot="button"
			class="[&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-background text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 has-[>_svg]:px-3 inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 py-2 text-sm font-medium outline-none transition-all hover:border-red-600 hover:bg-red-100 hover:text-red-600 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0"
			onclick={handleDelete}
		>
			<Trash2 aria-hidden="true" class="mr-2 h-4 w-4" />
			{$LL.suppliers_page.card.delete_supplier()}
		</button>
	</div>
</div>

<script lang="ts">
	import {
		BookCopy,
		Library,
		PackageMinus,
		Search,
		Settings,
		PersonStanding,
		Book,
		Truck,
		ChevronDown,
		Moon,
		Sun,
		Globe,
		CalendarClock
	} from "lucide-svelte";

	import { LL } from "@librocco/shared/i18n-svelte";

	import { appHash } from "$lib/paths";

	import { page } from "$app/stores";

	import LanguageSelector from "./LanguageSelector.svelte";

	interface Link {
		label: string;
		href: string;
		icon: any;
	}

	$: ({ nav: tNav } = $LL);

	let links: Link[];
	$: links = [
		{
			label: tNav.search(),
			href: appHash("stock"),
			icon: Search
		},
		{
			label: tNav.books(),
			href: appHash("books"),
			icon: Book
		},
		{
			label: tNav.inventory(),
			href: appHash("inventory"),
			icon: Library
		},
		{
			label: tNav.sale(),
			href: appHash("outbound"),
			icon: PackageMinus
		},
		{
			label: tNav.settings(),
			href: appHash("settings"),
			icon: Settings
		},
		{
			label: tNav.history(),
			href: appHash("history/date"),
			icon: CalendarClock
		},
		{
			label: "Customers",
			href: appHash("customers"),
			icon: PersonStanding
		},
		{
			label: tNav.supplier_orders(),
			href: appHash("supplier_orders"),
			icon: Truck
		}
	];
</script>

<div class="flex h-full w-full flex-col">
	<div class="relative flex h-16 w-full items-center border-b border-base-content">
		<div class="px-6 py-4 text-primary">
			<BookCopy strokeWidth={2} size={36} />
		</div>
		<!-- TODO: better app name font? -->
		<span class="text-xl font-medium">Librocco</span>
	</div>

	<nav class="grow p-2" aria-label="Main navigation">
		<ul class="menu gap-y-1">
			{#each links as { label, icon, href }}
				<li>
					<a {href} class={$page.url.hash.startsWith(href) ? "active" : ""}>
						<svelte:component this={icon} size={24} />
						{label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="flex w-full items-center justify-between gap-x-2 p-4">
		<LanguageSelector />
		<label class="flex cursor-pointer gap-2">
			<Sun size={20} />
			<input type="checkbox" value="sunset" class="theme-controller toggle" />
			<Moon size={20} />
		</label>
	</div>
</div>

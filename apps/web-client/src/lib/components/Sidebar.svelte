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
		Globe
	} from "lucide-svelte";

	import { LL } from "$i18n/i18n-svelte";

	import { appPath } from "$lib/paths";

	import { page } from "$app/stores";

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
			href: appPath("stock"),
			icon: Search
		},
		{
			label: tNav.inventory(),
			href: appPath("inventory"),
			icon: Library
		},
		{
			label: tNav.outbound(),
			href: appPath("outbound"),
			icon: PackageMinus
		},
		{
			label: tNav.settings(),
			href: appPath("settings"),
			icon: Settings
		},
		{
			label: tNav.history(),
			href: appPath("history/date"),
			icon: Book
		},
		{
			label: "Customers",
			href: appPath("customers"),
			icon: PersonStanding
		},
		{
			label: tNav.supplier_orders(),
			href: appPath("supplier_orders"),
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
					<a {href} class={$page.url.pathname === href ? "active" : ""}>
						<svelte:component this={icon} size={24} />

						{label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="flex w-full items-center justify-between gap-x-2 p-4">
		<div class="dropdown-top dropdown">
			<div tabindex="0" role="button" class="btn-ghost btn-sm btn">
				<Globe size={20} />
				<ChevronDown size={16} />
			</div>
			<div
				class="dropdown-content top-px mt-16 w-40 overflow-y-auto rounded-box border border-white/5 bg-base-200 text-base-content shadow-2xl outline-1 outline-black/5"
			>
				<!-- TODO: iterate list of langs that we have in dicts -->
				<ul class="menu menu-sm w-full bg-base-200">
					<li>
						<button class="active">
							<span class="font-mono font-bold opacity-40">EN</span>
							<span>English</span>
						</button>
					</li>
					<li class="disabled">
						<button>
							<span class="font-mono font-bold opacity-40">IT</span>
							<span>Italian</span>
						</button>
					</li>
				</ul>
			</div>
		</div>
		<label class="flex cursor-pointer gap-2">
			<Sun size={20} />
			<input type="checkbox" value="sunset" class="theme-controller toggle" />
			<Moon size={20} />
		</label>
	</div>
</div>

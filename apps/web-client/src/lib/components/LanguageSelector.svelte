<script lang="ts">
	import { Globe, ChevronDown } from "lucide-svelte";
	import { locale, setLocale } from "@librocco/shared/i18n-svelte";
	import { loadLocaleAsync } from "@librocco/shared/i18n-util.async";
	import { locales } from "@librocco/shared/i18n-util";
	import type { Locales } from "@librocco/shared";

	let open = false;

	function toggleDropdown() {
		open = !open;
	}

	type LocaleInfo = { code: Locales; name: string };

	function capitalize(str: string) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	// Function to get the native name of a locale
	function getLocaleName(code: string): string {
		const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
		return name ? capitalize(name) : code;
	}

	// Create the languages array dynamically using the imported locales
	const languages: LocaleInfo[] = locales.map((code) => ({
		code,
		name: getLocaleName(code)
	}));

	// Function to change the language
	async function changeLanguage(langCode: Locales) {
		await loadLocaleAsync(langCode);
		setLocale(langCode);

		// Store the selected language in localStorage using the default key
		localStorage.setItem("lang", langCode);
		open = false;
	}
</script>

<div class="dropdown-top dropdown">
	<button tabindex="0" type="button" class="btn-ghost btn-sm btn" on:click={toggleDropdown}>
		<Globe size={20} />
		<ChevronDown size={16} />
	</button>
	{#if open}
		<div
			class="dropdown-content top-px mt-16 w-40 overflow-y-auto rounded-box border border-white/5 bg-base-200 text-base-content shadow-2xl outline-1 outline-black/5"
		>
			<ul class="menu menu-sm w-full bg-base-200">
				{#each languages as lang}
					<li>
						<button class={$locale === lang.code ? "active" : ""} on:click={() => changeLanguage(lang.code)}>
							<span class="font-mono font-bold opacity-40">{lang.code.toUpperCase()}</span>
							<span>{lang.name}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

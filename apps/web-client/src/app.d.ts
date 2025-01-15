// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
// and what to do when importing types
declare namespace App {
	// interface Locals {}
	// interface Platform {}
	// interface PrivateEnv {}
	// interface PublicEnv {}
	// interface Session {}
}

// “virtual:pwa-info” just exports an object with some PWA metadata
declare module "virtual:pwa-info" {
	export const pwaInfo: {
		webManifest: {
			href?: string;
			useCredentials?: boolean;
			linkTag: string;
		} | null;
		registerSW?: string;
		swUrl?: string;
		// ... add more if you need type safety
	} | null;
}

// “virtual:pwa-register/svelte” exports the `useRegisterSW` function
declare module "virtual:pwa-register/svelte" {
	import type { RegisterSWOptions } from "vite-plugin-pwa/types";
	export function useRegisterSW(options?: RegisterSWOptions): {
		needRefresh: import("svelte/store").Writable<boolean>;
		offlineReady: import("svelte/store").Writable<boolean>;
		updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
	};
}

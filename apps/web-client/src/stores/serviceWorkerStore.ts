import { writable } from "svelte/store";

export const updateAvailable = writable(false);
export let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

export const initializeServiceWorker = async () => {
	if ("serviceWorker" in navigator) {
		serviceWorkerRegistration = await navigator.serviceWorker.ready;

		navigator.serviceWorker.addEventListener("message", (event) => {
			if (event.data?.type === "NEW_VERSION_AVAILABLE") {
				updateAvailable.set(true);
			}
		});

		navigator.serviceWorker.addEventListener("controllerchange", () => {
			window.location.reload();
		});
	}
};

export const checkForUpdates = async () => {
	if (serviceWorkerRegistration) {
		try {
			await serviceWorkerRegistration.update();
		} catch (error) {
			console.error("Error checking for updates:", error);
		}
	}
};

export const updateApp = () => {
	serviceWorkerRegistration?.waiting?.postMessage({ type: "SKIP_WAITING" });
};

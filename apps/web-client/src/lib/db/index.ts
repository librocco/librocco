import { persisted } from "svelte-local-storage-store";
import { writable } from "svelte/store";

/** Name of the currently active (and initalised) db - used to control the current in-app state */
export const dbName = writable("");
/** Persisted db name, this serves a way to persist currently used db between reloads (sessions) */
export const dbNamePersisted = persisted("librocco-current-db", "dev");

export const checkUrlConnection = async (url: string) => {
	const [credenialsAndUrl, urlEnd] = url.split("@");

	url = urlEnd === undefined ? url : `https://${urlEnd}`;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [_, credentials] = credenialsAndUrl.split("//");

	const headers = new Headers();
	const encodedCredentials = btoa(credentials);
	headers.append("Authorization", `Basic ${encodedCredentials}`);

	return fetch(url, {
		method: "GET",
		headers: headers,
		credentials: "include"
	});
};

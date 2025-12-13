import { derived } from "svelte/store";

import { AppDb } from "./db";

export class App {
	db = new AppDb();

	ready = derived([this.db.ready], ([$dbReady]) => $dbReady);
}

export const app = new App();

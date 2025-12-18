import { derived } from "svelte/store";

import { AppDb } from "./db";
import { AppSync } from "./sync";

export class App {
	db = new AppDb();
	sync = new AppSync();

	ready = derived([this.db.ready], ([$dbReady]) => $dbReady);
}

export const app = new App();

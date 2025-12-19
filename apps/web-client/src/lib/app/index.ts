import { derived } from "svelte/store";

import { AppDb } from "./db";
import { AppSync } from "./sync";
import { AppConfig } from "./config";

import { IS_DEMO } from "$lib/constants";

export class App {
	db = new AppDb();
	sync = new AppSync();
	config = IS_DEMO ? AppConfig.demo() : AppConfig.persisted();

	ready = derived([this.db.ready], ([$dbReady]) => $dbReady);
}

export const app = new App();

import { derived } from "svelte/store";

import { AppDb } from "./db";
import { AppSync } from "./sync";
import { AppConfig } from "./config";

import { IS_DEMO } from "$lib/constants";

export class App {
	// TODO: maybe implement App state -- currently we're relying on both:
	// - db state - as app state
	// - db error - as app error
	// Both are good enough considering the current flow, but would be good to
	// make the state global.
	get state() {
		return this.db.state;
	}

	db = new AppDb();
	sync = new AppSync();
	config = IS_DEMO ? AppConfig.demo() : AppConfig.persisted();

	ready = derived([this.db.ready], ([$dbReady]) => $dbReady);
}

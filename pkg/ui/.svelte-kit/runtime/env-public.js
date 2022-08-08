/** @type {App.PublicEnv} */
let env = {};

/** @type {(environment: Record<string, string>) => void} */
function set_public_env(environment) {
	env = environment;
}

export { env, set_public_env };

/** @type {App.PrivateEnv} */
let env = {};

/** @type {(environment: Record<string, string>) => void} */
function set_private_env(environment) {
	env = environment;
}

export { env, set_private_env };

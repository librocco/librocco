import type { Load } from '@sveltejs/kit';

import { initDB } from '$lib/db';

export const load: Load = async () => {
	await initDB();
};

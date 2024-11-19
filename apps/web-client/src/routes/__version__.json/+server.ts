import { VERSION } from "$lib/constants";
import { json } from "@sveltejs/kit";

export const prerender = true;

export function GET() {
	return json(
		{ version: VERSION },
		{
			headers: {
				"Cache-Control": "no-store"
			}
		}
	);
}

import type { Format } from "../db/cr-sqlite/types";
export const orderFormats: Record<string, Format> = {
	pbm: "PBM",
	standard: "Standard",
	rcs3: "RCS-3",
	rcs5: "RCS-5",
	loescher3: "Loescher-3",
	loescher5: "Loescher-5"
};

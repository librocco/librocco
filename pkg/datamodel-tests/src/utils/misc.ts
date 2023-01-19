import { VolumeStock } from '@/types';

export const sortBooks = (
	{ isbn: i1, warehouse: w1 }: VolumeStock,
	{ isbn: i2, warehouse: w2 }: VolumeStock
) => (i1 < i2 ? -1 : i1 > i2 ? 1 : w1 < w2 ? -1 : 1);

/** Replaces JS friendly version name ('version_1_1') with a human friendly version name ('version 1.1') */
export const processVersionName = (s: string): string => s.replace('_', ' ').replace('_', '.');

/** Replaces JS friendly test function name ('commitNotes') with a human friendly test name ('commit notes') */
export const processTestName = (s: string): string =>
	s.replaceAll(/([A-Z]|[0-9]+)/g, (c) => ' ' + c.toLowerCase());

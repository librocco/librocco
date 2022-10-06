import { VolumeStock } from '@/types';

export const sortBooks = (
	{ isbn: i1, warehouse: w1 }: VolumeStock,
	{ isbn: i2, warehouse: w2 }: VolumeStock
) => (i1 < i2 ? -1 : i1 > i2 ? 1 : w1 < w2 ? -1 : 1);

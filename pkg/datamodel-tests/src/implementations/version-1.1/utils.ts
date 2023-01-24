import { VolumesByISBN } from './types';

export const addVolumeWarehouseQuantityToStock = (
	stock: VolumesByISBN,
	isbn: string,
	warehouse: string,
	quantity: number
): VolumesByISBN =>
	!stock[isbn]
		? { ...stock, [isbn]: { [warehouse]: quantity } }
		: !stock[isbn][warehouse]
		? { ...stock, [isbn]: { ...stock[isbn], [warehouse]: quantity } }
		: { ...stock, [isbn]: { ...stock[isbn], [warehouse]: stock[isbn][warehouse] + quantity } };

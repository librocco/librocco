export interface Note {
	_id: string;
	books: Volume[];
}

export interface BookData {
	isbn: string;
	title: string;
	author: string;
	editor: string;
}
export interface Volume extends BookData {
	price: number;
	quantity: number;
	note: string;
	date: string;
}

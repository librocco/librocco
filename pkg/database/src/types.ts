export interface Note {
	_id: string;
	books: BookInterface[];
}

export interface BookInterface {
	isbn: string;
	title: string;
	author: string;
	editor: string;
	price: number;
	quantity: number;
	note?: string;
	date?: string;
}

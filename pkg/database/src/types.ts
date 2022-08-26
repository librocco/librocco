export interface Note {
	_id: string;
    books: BookCopyInterface[];
}

export interface BookDataInterface {
	isbn: string;
	title: string;
	author: string;
	editor: string;
}
export interface BookCopyInterface extends BookDataInterface {
	price: number;
	quantity: number;
    note: string;
    date: string;
}

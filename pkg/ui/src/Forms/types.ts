export interface BookEntry {
	isbn: string;
	title: string;
	authors?: string[];
	publisher?: string;
	year?: string;
	price?: number;
}
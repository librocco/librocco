interface IndustryIdentifier {
	type: 'ISBN_10' | 'ISBN_13';
	identifier: string;
}

export interface RawBook {
	volumeInfo: {
		title: string;
		authors: string[];
		publisher: string;
		publishedDate: string;
		industryIdentifiers: IndustryIdentifier[];
		categories: string[];
		language: string;
	};
}

interface RawBookStock extends RawBook {
	warehouse: string;
	quantity: number;
}

export interface RawNote {
	id: string;
	type: 'in-note' | 'out-note';
	books: RawBookStock[];
}

export interface RawDBSnap {
	id: string;
	books: RawBookStock[];
}

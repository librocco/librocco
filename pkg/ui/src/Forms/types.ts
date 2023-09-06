export interface BookEntry {
	isbn: string;
	title: string;
	price: number;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
}

export interface RemoteDbConfig {
	url: string;
	direction: "to" | "from" | "sync";
	live: boolean;
	retry: boolean;
}

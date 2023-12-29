export interface RemoteDbConfig {
	url: string;
	direction: "to" | "from" | "sync";
	live: boolean;
	retry: boolean;
}

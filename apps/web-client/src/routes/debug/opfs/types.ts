export enum Tag {
	OPEN = "open",
	EXEC = "exec"
}

export type WkrMsg<T extends Tag> = {
	_id: number;
	_tag: T;
	_dbid: string;
	reqBody: any;
	status?: "ok" | "error";
	resBody?: any;
	error?: string;
};

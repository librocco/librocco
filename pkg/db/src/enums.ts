export enum DocType {
	Note = "note",
	Warehouse = "warehouse",
	PrintJob = "print_job",
	CustomerOrder = "customer_order",
	StockArchive = "stock_archive"
}

export enum PrintJobStatus {
	Pending = "PENDING",
	Processing = "PROCESSING",
	Done = "DONE",
	Error = "ERROR"
}

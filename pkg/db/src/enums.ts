export enum DocType {
	Note = "note",
	Warehouse = "warehouse",
	PrintJob = "print_job",
	Supplier = "supplier",
	CustomerOrder = "customer_order"
}

export enum PrintJobStatus {
	Pending = "PENDING",
	Processing = "PROCESSING",
	Done = "DONE",
	Error = "ERROR"
}

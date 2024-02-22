export enum DocType {
	Note = "note",
	Warehouse = "warehouse",
	PrintJob = "print_job",
	Supplier = "supplier",
	CustomerOrder = "customer_order",
	OrderBatch = "order_batch"
}

export enum PrintJobStatus {
	Pending = "PENDING",
	Processing = "PROCESSING",
	Done = "DONE",
	Error = "ERROR"
}

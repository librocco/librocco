CREATE TABLE customer (
	id INTEGER NOT NULL,
	display_id TEXT,
	fullname TEXT,
	email TEXT,
	deposit DECIMAL,
	updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
	PRIMARY KEY (id)
);

CREATE TABLE customer_order_lines (
	id INTEGER NOT NULL,
	customer_id INTEGER,
	isbn TEXT,
	created INTEGER DEFAULT (strftime('%s', 'now') * 1000),
	placed INTEGER,
	received INTEGER,
	collected INTEGER,
	PRIMARY KEY (id)
);

-- We can't  specify the foreign key constraint since cr-sqlite doesn't support it:
-- Table customer_order_lines has checked foreign key constraints. CRRs may have foreign keys
-- but must not have checked foreign key constraints as they can be violated by row level security or replication.
-- FOREIGN KEY (customer_id) REFERENCES customer(id) ON UPDATE CASCADE ON DELETE CASCADE

-- Activate the crsql extension
SELECT crsql_as_crr('customer');
SELECT crsql_as_crr('customer_order_lines');

CREATE TABLE book (
	isbn TEXT NOT NULL,
	title TEXT,
    authors TEXT,
    price DECIMAL,
	year INTEGER,
	publisher TEXT,
	edited_by TEXT,
	out_of_print INTEGER,
	category TEXT,
	updated_at INTEGER,
    PRIMARY KEY (isbn)
);
SELECT crsql_as_crr('book');

CREATE TABLE supplier (
	id INTEGER NOT NULL,
	name TEXT,
	email TEXT,
	address TEXT,
	PRIMARY KEY (id)
);
SELECT crsql_as_crr('supplier');

CREATE TABLE supplier_publisher (
	supplier_id INTEGER,
	publisher TEXT NOT NULL,
	PRIMARY KEY (publisher)
);
SELECT crsql_as_crr('supplier_publisher');

CREATE TABLE supplier_order (
	id INTEGER NOT NULL,
	supplier_id INTEGER,
	created INTEGER DEFAULT (strftime('%s', 'now') * 1000),
	PRIMARY KEY (id)
);
SELECT crsql_as_crr('supplier_order');

CREATE TABLE supplier_order_line (
	supplier_order_id INTEGER NOT NULL,
	isbn TEXT NOT NULL,
	quantity INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY (supplier_order_id, isbn)
);
SELECT crsql_as_crr('supplier_order_line');

CREATE TABLE reconciliation_order (
	id INTEGER NOT NULL,
	supplier_order_ids TEXT CHECK (json_valid(supplier_order_ids) AND json_array_length(supplier_order_ids) >= 1),
	created INTEGER DEFAULT (strftime('%s', 'now') * 1000),
	updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
	finalized INTEGER DEFAULT 0,
	PRIMARY KEY (id)
);
SELECT crsql_as_crr('reconciliation_order');

CREATE TABLE reconciliation_order_lines (
	reconciliation_order_id INTEGER NOT NULL,
	isbn TEXT NOT NULL,
	quantity INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY (reconciliation_order_id, isbn)
);
SELECT crsql_as_crr('reconciliation_order_lines');

CREATE TABLE customer_order_line_supplier_order (
	customer_order_line_id INTEGER NOT NULL,
	supplier_order_id INTEGER NOT NULL,
	placed INTEGER DEFAULT 0,
	PRIMARY KEY (customer_order_line_id, supplier_order_id)
);
SELECT crsql_as_crr('customer_order_line_supplier_order');

CREATE TABLE warehouse (
	-- 0 id is reserved -- when warehouse id is unassigned (in a book txn for ex.) we're defaulting to 0
	-- using 0 instead of NULL as 0 = 0 and NULL != NULL
    id INTEGER NOT NULL CHECK (id <> 0),
    display_name TEXT,
    discount DECIMAL DEFAULT 0,
    PRIMARY KEY (id)
);
SELECT crsql_as_crr('warehouse');

-- if warehouse_id is not null, the note is inbound
-- if is_reconciliation_note is true (1) - it's a reconciliation note (obvious)
-- if the note is not inbound, nor reconciliation, it is outbound
CREATE TABLE note (
	id INTEGER NOT NULL,
	display_name TEXT,
	warehouse_id INTEGER,
	is_reconciliation_note INTEGER DEFAULT 0,
	default_warehouse INTEGER,
	updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
	committed INTEGER NOT NULL DEFAULT 0,
	committed_at INTEGER,
	PRIMARY KEY (id)
);
SELECT crsql_as_crr('note');

CREATE TABLE book_transaction (
	isbn TEXT NOT NULL,
	quantity INTEGER NOT NULL DEFAULT 0,
	note_id INTEGER NOT NULL,
	warehouse_id INTEGER NOT NULL DEFAULT 0,
	updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
	committed_at INTEGER,
	PRIMARY KEY (isbn, note_id, warehouse_id)
);


CREATE TABLE custom_item (
	id INTEGER NOT NULL,
	title TEXT,
	price DECIMAL,
	note_id INTEGER,
	updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
	PRIMARY KEY (id, note_id)
);


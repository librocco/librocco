CREATE TABLE customer (
	id INTEGER NOT NULL,
	fullname TEXT,
	email TEXT,
	deposit DECIMAL,
	PRIMARY KEY (id)
);

CREATE TABLE customer_order_lines (
	id INTEGER NOT NULL,
	customer_id TEXT,
	isbn TEXT,
	quantity INTEGER,
	created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	placed TIMESTAMP,
	received TIMESTAMP,
	collected TIMESTAMP,
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
	publisher TEXT,
	price DECIMAL,
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

CREATE TABLE customer_supplier_order (
	id INTEGER NOT NULL,
	supplier_order_id INTEGER,
	customer_order_line_id INTEGER,
	PRIMARY KEY (id)
);
SELECT crsql_as_crr('customer_supplier_order');


CREATE TABLE customer (
	id INTEGER NOT NULL,
	fullname TEXT,
	email TEXT,
	deposit DECIMAL,
	updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
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

CREATE TRIGGER update_customer_timestamp_upsert_customer
AFTER UPDATE ON customer
FOR EACH ROW
BEGIN
	UPDATE customer
    SET updatedAt = (strftime('%s', 'now') * 1000)
    WHERE id = NEW.id;
END;

CREATE TRIGGER update_customer_timestamp_insert
AFTER INSERT ON customer_order_lines
FOR EACH ROW
BEGIN
    UPDATE customer
    SET updatedAt = (strftime('%s', 'now') * 1000)
    WHERE id = NEW.customer_id;
END;

CREATE TRIGGER update_customer_timestamp_delete
AFTER DELETE ON customer_order_lines
FOR EACH ROW
BEGIN
    UPDATE customer
    SET updatedAt = (strftime('%s', 'now') * 1000)
    WHERE id = OLD.customer_id;
END;

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

CREATE TABLE reconciliation_order (
	id INTEGER NOT NULL,
	supplier_order_ids TEXT CHECK (json_valid(supplier_order_ids) AND json_array_length(supplier_order_ids) >= 1),
	created INTEGER DEFAULT (strftime('%s', 'now') * 1000),
	customer_order_line_ids TEXT CHECK (json_valid(supplier_order_ids)),
	finalized INTEGER DEFAULT 0,
	PRIMARY KEY (id)
);
SELECT crsql_as_crr('reconciliation_order');

CREATE TABLE warehouse (
    id INTEGER NOT NULL,
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
	committed INTEGER DEFAULT 0,
	committed_at INTEGER,
	PRIMARY KEY (id)
);
SELECT crsql_as_crr('note');

CREATE TABLE book_transaction (
	isbn TEXT NOT NULL,
	quantity INTEGER NOT NULL DEFAULT 0,
	note_id INTEGER NOT NULL,
	warehouse_id INTEGER,
	updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
	committed_at INTEGER,
	PRIMARY KEY (isbn, note_id, warehouse_id)
);

CREATE TRIGGER update_note_timestamp_after_insert
AFTER INSERT ON book_transaction
FOR EACH ROW
BEGIN
    UPDATE note
    SET updated_at = (strftime('%s', 'now') * 1000)
    WHERE id = NEW.note_id AND committed = 0;
END;

CREATE TRIGGER update_note_timestamp_after_update
AFTER UPDATE ON book_transaction
FOR EACH ROW
BEGIN
    UPDATE note
    SET updated_at = (strftime('%s', 'now') * 1000)
    WHERE id = NEW.note_id AND committed = 0;
END;

CREATE TRIGGER update_note_timestamp_after_delete
AFTER DELETE ON book_transaction
FOR EACH ROW
BEGIN
    UPDATE note
    SET updated_at = (strftime('%s', 'now') * 1000)
    WHERE id = OLD.note_id AND committed = 0;
END;

CREATE TABLE custom_item (
	id INTEGER NOT NULL,
	title TEXT,
	price DECIMAL,
	note_id INTEGER,
	PRIMARY KEY (id, note_id)
);

CREATE TRIGGER update_note_timestamp_after_custom_item_insert
AFTER INSERT ON custom_item
FOR EACH ROW
BEGIN
    UPDATE note
    SET updated_at = (strftime('%s', 'now') * 1000)
    WHERE id = NEW.note_id AND committed = 0;
END;

CREATE TRIGGER update_note_timestamp_after_custom_item_update
AFTER UPDATE ON custom_item
FOR EACH ROW
BEGIN
    UPDATE note
    SET updated_at = (strftime('%s', 'now') * 1000)
    WHERE id = NEW.note_id AND committed = 0;
END;

CREATE TRIGGER update_note_timestamp_after_custom_item_delete
AFTER DELETE ON custom_item
FOR EACH ROW
BEGIN
    UPDATE note
    SET updated_at = (strftime('%s', 'now') * 1000)
    WHERE id = OLD.note_id AND committed = 0;
END;


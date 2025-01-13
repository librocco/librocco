const exampleData = `
-- Books
INSERT INTO book (isbn, title, authors, publisher, price) VALUES
('9781234567897', 'The Art of Learning', 'Josh Waitzkin', 'Scholastic', 15.99),
('9788804797142', 'Lord of the Flies', 'William Golding', 'Mondadori', 18.0),
('9780385504201', 'The Da Vinci Code', 'Dan Brown', 'Doubleday', 19.95),
('9780553296983', 'Dune', 'Frank Herbert', 'Ace', 24.50);

-- Suppliers
INSERT INTO supplier (id, name, email, address) VALUES
(1, 'BooksRUs', 'contact@booksrus.com', '123 Book St, New York, NY'),
(2, 'NovelSupply Co.', 'support@novelsupply.co', '456 Fiction Ave, Los Angeles, CA');

-- Supplier Publisher Relationships
INSERT INTO supplier_publisher (supplier_id, publisher) VALUES
(1, 'Mondadori'),
(1, 'Doubleday'),
(2, 'Scholastic'),
(2, 'Ace');

-- Customers
INSERT INTO customer (id, fullname, email, deposit) VALUES
(1, 'Alice Smith', 'alice.smith@example.com', 50.00),
(2, 'Bob Johnson', 'bob.johnson@example.com', 30.00);

-- Customer Order Lines
INSERT INTO customer_order_lines (id, customer_id, isbn, placed, received, collected) VALUES
(1, 1, '9780590353427', 1, 0, 0),
(2, 1, '9780439064873', 1, 1, 0),
(3, 2, '9780385504201', 1, 1, 1),
(4, 2, '9780553296983', 1, 0, 0);

-- Supplier Orders
INSERT INTO supplier_order (id, supplier_id, created) VALUES
(1, 1, 1700000000000),
(2, 2, 1700005000000);

-- Supplier Order Lines
INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity) VALUES
(1, '9780590353427', 5),
(2, '9780439064873', 3);

-- Customer Supplier Orders
INSERT INTO customer_supplier_order (id, supplier_order_id, customer_order_line_id) VALUES
(1, 1, 1),
(2, 2, 2);

-- Reconciliation Orders
INSERT INTO reconciliation_order (id, supplier_order_ids, created, customer_order_line_ids, finalized) VALUES
(1, '[1]', 1700010000000, '[1,2]', 0),
(2, '[2]', 1700020000000, '[3]', 1);
`;

export default exampleData;

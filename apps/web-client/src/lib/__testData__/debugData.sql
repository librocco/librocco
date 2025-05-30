-- Books
INSERT INTO book (isbn, title, authors, publisher, price) VALUES
('9781234567897', 'The Art of Learning', 'Josh Waitzkin', 'Scholastic', 15.99),
('9788804797142', 'Lord of the Flies', 'William Golding', 'Mondadori', 18.0),
('9780385504201', 'The Da Vinci Code', 'Dan Brown', 'Doubleday', 19.95),
('9780553296983', 'Dune', 'Frank Herbert', 'Ace', 24.50),
('9780590353427', 'Harry Potter and the Sorcerer''s Stone', 'J.K. Rowling', 'Scholastic', 12.50);

-- Suppliers
INSERT INTO supplier (id, name, email, address, customerId) VALUES
(1, 'BooksRUs', 'contact@booksrus.com', '123 Book St, New York, NY', 1111),
(2, 'NovelSupply Co.', 'support@novelsupply.co', '456 Fiction Ave, Los Angeles, CA', 2222);

-- Supplier Publisher Relationships
INSERT INTO supplier_publisher (supplier_id, publisher) VALUES
(1, 'Mondadori'),
(1, 'Doubleday'),
(2, 'Scholastic'),
(2, 'Ace');

-- Customers
INSERT INTO customer (id, display_id, fullname, email, deposit) VALUES
(1, '1', 'Alice Smith', 'alice.smith@example.com', 50.00),
(2, '2', 'Bob Johnson', 'bob.johnson@example.com', 30.00);

-- Customer Order Lines
INSERT INTO customer_order_lines (id, customer_id, isbn, placed, received, collected) VALUES
(1, 1, '9781234567897', 1, null, null),
(2, 1, '9788804797142', 1, 1, null),
(3, 1, '9780385504201', null, null, null),
(4, 2, '9780385504201', 1, 1, 1),
(5, 2, '9780553296983', 1, null, null),
(6, 2, '9781234567897', null, null, null);

-- Supplier Orders
INSERT INTO supplier_order (id, supplier_id, created) VALUES
(1, 1, 1700000000000),
(2, 2, 1700005000000);

-- Supplier Order Lines
INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity) VALUES
(1, '9780590353427', 5),
(2, '9780439064873', 3);

-- Reconciliation Orders
INSERT INTO reconciliation_order (supplier_order_ids, finalized) VALUES
('[1]', 0),
('[2]', 1);

-- Reconciliation Order Lines
INSERT INTO reconciliation_order_lines (reconciliation_order_id, isbn) VALUES
(1, '9781234567897'),
(2, '9788804797142');

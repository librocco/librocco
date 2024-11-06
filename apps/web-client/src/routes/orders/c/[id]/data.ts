// data.ts

type Customer = {
    id: number;
    fullname: string;
    email: string;
    deposit: number;
  };
  
  type CustomerOrderLine = {
    id: number;
    customer_id: number;
    isbn: string;
    quantity: number;
    created: number;
    placed: number;
    received: number;
    collected: number;
  };
  
  // Sample customers
  const customers: Customer[] = [
    { id: 1, fullname: 'John Doe', email: 'johndoe@example.com', deposit: 100.50 },
    { id: 2, fullname: 'Jane Smith', email: 'janesmith@example.com', deposit: 200.75 },
  ];
  
  // Sample order lines with calculated timestamps
  const baseTimestamp = Date.now();
  
  const customerOrderLines: CustomerOrderLine[] = [
    { id: 1, customer_id: 1, isbn: '9781234567897', quantity: 2, created: baseTimestamp, placed: baseTimestamp + 3600 * 1000, received: baseTimestamp + 86400 * 1000, collected: baseTimestamp + 172800 * 1000 },
    { id: 2, customer_id: 1, isbn: '9781234567880', quantity: 1, created: baseTimestamp, placed: baseTimestamp + 3600 * 1000, received: baseTimestamp + 86400 * 1000, collected: baseTimestamp + 172800 * 1000 },
    { id: 3, customer_id: 1, isbn: '9781234567873', quantity: 3, created: baseTimestamp, placed: baseTimestamp + 3600 * 1000, received: baseTimestamp + 86400 * 1000, collected: baseTimestamp + 172800 * 1000 },
    { id: 4, customer_id: 1, isbn: '9781234567866', quantity: 2, created: baseTimestamp, placed: baseTimestamp + 3600 * 1000, received: baseTimestamp + 86400 * 1000, collected: baseTimestamp + 172800 * 1000 },
    { id: 5, customer_id: 1, isbn: '9781234567859', quantity: 4, created: baseTimestamp, placed: baseTimestamp + 3600 * 1000, received: baseTimestamp + 86400 * 1000, collected: baseTimestamp + 172800 * 1000 },
    { id: 6, customer_id: 2, isbn: '9780987654321', quantity: 1, created: baseTimestamp, placed: baseTimestamp + 3600 * 1000, received: baseTimestamp + 86400 * 1000, collected: baseTimestamp + 172800 * 1000 },
    { id: 7, customer_id: 2, isbn: '9780987654314', quantity: 3, created: baseTimestamp, placed: baseTimestamp + 3600 * 1000, received: baseTimestamp + 86400 * 1000, collected: baseTimestamp + 172800 * 1000 },
    { id: 8, customer_id: 2, isbn: '9780987654307', quantity: 2, created: baseTimestamp, placed: baseTimestamp + 3600 * 1000, received: baseTimestamp + 86400 * 1000, collected: baseTimestamp + 172800 * 1000 },
    { id: 9, customer_id: 2, isbn: '9780987654291', quantity: 5, created: baseTimestamp, placed: baseTimestamp + 3600 * 1000, received: baseTimestamp + 86400 * 1000, collected: baseTimestamp + 172800 * 1000 },
    { id: 10, customer_id: 2, isbn: '9780987654284', quantity: 1, created: baseTimestamp, placed: baseTimestamp + 3600 * 1000, received: baseTimestamp + 86400 * 1000, collected: baseTimestamp + 172800 * 1000 },
  ];
  
  // Export the data
  export const data = {
    customers,
    customerOrderLines,
  };
  
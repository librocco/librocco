import React, { useEffect } from "react";
import PouchDB from 'pouchdb';
import { Search as JSSearch } from 'js-search';


const pouchDb = new PouchDB('http://admin:admin@localhost:5984/books');
window.pouchDb = pouchDb;

const indexBooks = async function() {
  // Loop over all elements in the pouchdb database
  const docs = await pouchDb.allDocs({include_docs: true});
  const search = new JSSearch("isbn");
  search.addIndex('title');
  search.addIndex('author');
  search.addIndex('publisher');
  // Loop 20 times
  console.log("start")
  await window.bookIndex.addDocuments(docs.rows.map(row => row.doc));
  console.log("finish")
}

window.bookIndex = new JSSearch("isbn");
window.bookIndex.addIndex('title');
window.bookIndex.addIndex('author');
window.bookIndex.addIndex('publisher');

const Search: React.FC = () => {
  useEffect(() => {indexBooks(); return undefined}, []);
  // Put the windows style newline into the variable winnewline
  const winnewline = "\r\n";
  // Put the unix style newline into the variable winnewline
  const unixnewline = "\n";


  const [books, setBooks] = React.useState([]);
  const [total, setTotal] = React.useState(0);

  const manageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const result = bookIndex.search(e.target.value);
    setBooks(result.slice(0, 10))
    setTotal(result.length);
  }

  return (
    <div className="foobar">
      <h2 className="text-[2.5rem]">Search books</h2>
      <input className="border-2" onChange={(manageChange)} />
      <h3>{total} books found</h3>
      <ul>
        {books.map(book => (
          <li key={book.isbn}> {book.title} </li>
        ))}
      </ul>
    </div>
  )
};

export default Search;

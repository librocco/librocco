import React, { useEffect } from "react";
import PouchDB from 'pouchdb';
import { Search as JSSearch } from 'js-search';


const localDB = new PouchDB('books')
const couchDb = new PouchDB('http://admin:admin@localhost:5984/books');
localDB.replicate.to(couchDb);
localDB.replicate.from(couchDb);
window.couchDb = couchDb;
window.localDB = localDB;
window.bookIndex = new JSSearch("isbn");
window.bookIndex.addIndex('title');
window.bookIndex.addIndex('author');
window.bookIndex.addIndex('publisher');


const saveIndex = async function(index) {
  var db;
  var request = indexedDB.open("MyTestDatabase");
  request.onerror = event => {
    console.log("Why didn't you allow my web app to use IndexedDB?!");
  };
  request.onsuccess = event => {
    db = event.target.result;
  };  
}


const loadIndex = async function() {
  return {};
}

const Search: React.FC = () => {
  const [books, setBooks] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [found, setFound] = React.useState(0);
  const [status, setStatus] = React.useState("Initializing");
  
  const indexBooks = async function() {
    // Loop over all elements in the pouchdb database
    setStatus("Retrieving documents from Pouchdb");
    const docs = await localDB.allDocs({include_docs: true, limit: 1000});
    const search = new JSSearch("isbn");
    search.addIndex('title');
    search.addIndex('author');
    search.addIndex('publisher');
    // Loop 20 times
    console.log("start")
    setStatus(`Creating index for ${docs.rows.length} books`);
    await window.bookIndex.addDocuments(docs.rows.map(row => row.doc));
    setTotal(window.bookIndex._documents.length);
    setStatus(`Ready`);
    // setStatus(`Ready to save to indexedDb`);
    // var request = window.indexedDB.open("MyTestDatabase", 3);
    // request.onsuccess = event => {
    //   db = event.target.result;
    // };
    
    console.log("finish")
  }
  useEffect(() => {indexBooks()}, []);
  

  const manageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const result = bookIndex.search(e.target.value).filter(el => el.isbn);
    setBooks(result.slice(0, 10))
    setFound(result.length);
  }

  return (
    <div className="foobar">
      <h2 className="text-[2.5rem]">Search books - {status}</h2>
      <input className="border-2" onChange={(manageChange)} />
      <h3>{found} books found ({total} in total)</h3>
      <ul>
        {books.map(book => (
          <li key={book.isbn}>{book.isbn} - <b>{book.author}</b> - {book.title} </li>
        ))}
      </ul>
    </div>
  )
};

export default Search;

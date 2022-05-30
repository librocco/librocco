CLI Scripts
===========

This directory contains scripts that can be run from the command line.

The scripts in this directory are meant to be invoked using their path.
They might require [`deno`](https://deno.land) or other not so usual runtime.
They MUST have tests that at least exercise the basic functionality.
The `package.json` in this directory primarily is there to provide `jest`
to be able to test the scripts.
Use `rushx test` in this directory to run scripts tests.

* [Import books](#import-books)


Import books
------------

Example usage:

```bash
./scripts/csv-to-couchdb.ts parse -c isbn,author,title,numero_volumi,codice_editore,publisher,codice_collana,collana,numero_collana,data_nascita,data_fuoricatalogo,data_pubblicazione,prezzo,codice_iva,iva,notizia_libro_descrizione,isbn,codice_editore,numero_interno -f ~/Downloads/varia.csv -s '|'
```
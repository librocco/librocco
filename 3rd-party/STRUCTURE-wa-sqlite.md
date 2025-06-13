# Project Structure

This document outlines the structure of the `wa-sqlite` project.

## Fetching SQLite Source

The SQLite source code is not checked into this repository. Instead, it is fetched and prepared as part of the build process. This is managed by the `Makefile`.

### Process

1.  **Configuration**: The `Makefile` defines the version of SQLite to be used with the `SQLITE_VERSION` variable (e.g., `version-3.45.0`). It also defines the URL from which to download the source tarball.

2.  **Downloading**: When you run `make deps` (or a target that depends on it, like `make all`), `make` will:
    a. Create a `cache` directory if it doesn't exist.
    b. Download the SQLite source tarball from `https://www.sqlite.org/src/` using `curl`.
    c. Extract the contents of the tarball into `cache/sqlite-version-X.X.X`.

3.  **Building the Amalgamation**: After downloading and extracting, the build process will:
    a. Create a `deps/sqlite-version-X.X.X` directory.
    b. Change into that directory.
    c. Run the `configure` script that came with the SQLite source.
    d. Run `make sqlite3.c` to generate the SQLite amalgamation source file. The amalgamation combines many different source files into a single `sqlite3.c` file for easier compilation.

4.  **Usage**: The generated `deps/version-X.X.X/sqlite3.c` file is then used as a source file for the Emscripten compiler (`emcc`) to build the WebAssembly module.

This approach ensures that the project uses a specific, known version of SQLite and that the source is obtained directly from the official SQLite website during the build.

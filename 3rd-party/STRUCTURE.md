# Project Structure and WASM Build Process

This document outlines the structure of the `cr-sqlite` project, how it is built, and how it relates to its dependencies for running in different environments, with a focus on Web Assembly (WASM).

## Overview

`cr-sqlite` is a SQLite extension written as a hybrid of C and Rust. This architecture leverages the safety and modern features of Rust for the core logic, while using C as a compatibility layer to interface directly with SQLite's C-based extension API.

A key design goal of this project is to run in native environments as well as in the browser as a Web Assembly module.

## Core Components (`cr-sqlite/core`)

The project is primarily organized into a C layer and a Rust layer, both located within the `core/` directory.

### C Layer (`core/src/`)

This directory contains the C source code that serves as the bridge between SQLite and the Rust library.

- **`crsqlite.c`**: Implements the main SQLite extension entry point (`sqlite3_crsqlite_init`). It's responsible for registering the extension's virtual tables and hooks with SQLite.
- **`changes-vtab.c`**: Implements the C-side of the `crsql_changes` virtual table, delegating calls to the Rust implementation.
- **`ext-data.c`**: Manages the per-connection state (`crsql_ExtData`) required by the extension.
- **`sqlite/`**: A copy of the SQLite amalgamation source. This is used for building test utilities and for creating statically linked artifacts.

### Rust Layer (`core/rs/`)

This directory contains the Rust crates that implement the core logic of `cr-sqlite`.

- **`bundle`**: This is the primary Rust crate containing the core conflict-free replicated data type (CRDT) logic, virtual table implementations, and data synchronization algorithms.

- **`bundle_static`**: This is a wrapper crate that acts as a build harness. Its `Cargo.toml` defines features (`static`, `loadable_extension`) which control how the `bundle` crate is compiled for different targets. The `core/Makefile` directly invokes `cargo` on this crate.

- **`sqlite-rs-embedded`**: This git submodule provides `no_std` (standard library-free) Rust bindings to the SQLite C API. It is a critical component that enables `cr-sqlite` to be compiled for environments where the Rust standard library is not available, most notably Web Assembly. It is composed of several smaller crates:
    - `sqlite3_capi`: Uses `bindgen` to generate raw FFI bindings to the SQLite C API.
    - `sqlite3_allocator`: Provides a custom global allocator that uses SQLite's memory functions (`sqlite3_malloc`, `sqlite3_free`). This is essential for `no_std` environments.
    - `sqlite_nostd`: Provides safe, idiomatic Rust wrappers around the raw C API bindings.
    - `sqlite_web`: Provides shims and configurations needed for compiling to WASM.

## Build System

The entire project is orchestrated by `make`. For details on the native build process, see [STRUCTURE-cr-sqlite.md](./STRUCTURE-cr-sqlite.md). The WASM build is handled by the `wa-sqlite` project.

### Web Assembly Build (`wa-sqlite/Makefile`)

The Web Assembly version of `cr-sqlite` is built via the `wa-sqlite` project's `Makefile`. This process compiles both `cr-sqlite` and `wa-sqlite` into a single WASM module.

#### Dependency: `wa-sqlite` and SQLite Source

The `wa-sqlite` project is a dependency for running `cr-sqlite` in the browser. Its build process is responsible for fetching the SQLite source code.

1.  **Configuration**: The `wa-sqlite/Makefile` defines the `SQLITE_VERSION` to be used.
2.  **Downloading**: `make deps` downloads the specified SQLite source tarball from `sqlite.org`.
3.  **Building the Amalgamation**: The build process runs `configure` and `make sqlite3.c` to generate the SQLite amalgamation, which combines many source files into a single `sqlite3.c` for easier compilation.

#### `cr-sqlite` WASM Compilation Process

The `wa-sqlite/Makefile` orchestrates a multi-step compilation process using Emscripten (`emcc`):

1.  **Compile `cr-sqlite` Rust Code**: The Makefile invokes `cargo build` on the `cr-sqlite` Rust code (`crsql_bundle`).
    - It uses the `--target wasm32-unknown-emscripten` flag.
    - It passes the `static` and `omit_load_extension` features.
    - Crucially, it uses the `RUSTFLAGS="--emit=llvm-bc"` flag, which tells `cargo` to output LLVM bitcode (`.bc`) files instead of a final WASM binary.

2.  **Compile C Code**: The Makefile compiles all necessary C source files into object files using `emcc`. This includes:
    - `wa-sqlite`'s own C files (e.g., `libvfs.c`).
    - `cr-sqlite`'s C files (e.g., `crsqlite.c`, `changes-vtab.c`).
    - The SQLite amalgamation (`sqlite3.c`).

3.  **Link to Final WASM Module**: Finally, `emcc` is called one last time to link everything together. It takes the compiled C object files and the `cr-sqlite` Rust LLVM bitcode files (`.bc`) as input and produces the final, unified WASM module (e.g., `dist/crsqlite.mjs` and `dist/crsqlite.wasm`).

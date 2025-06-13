# Project Structure and Build Process

This document outlines the structure of the `cr-sqlite` project, how it is built, and how it relates to web environments via Web Assembly (WASM).

## Overview

`cr-sqlite` is a SQLite extension written as a hybrid of C and Rust. This architecture leverages the safety and modern features of Rust for the core logic, while using C as a compatibility layer to interface directly with SQLite's C-based extension API.

## Core Components

The project is primarily organized into a C layer and a Rust layer, both located within the `core/` directory.

### C Layer (`core/src/`)

This directory contains the C source code that serves as the bridge between SQLite and the Rust library.

- **`crsqlite.c`**: Implements the main SQLite extension entry point (`sqlite3_crsqlite_init`). It's responsible for registering the extension's virtual tables and hooks with SQLite.
- **`changes-vtab.c`**: Implements the C-side of the `crsql_changes` virtual table, delegating calls to the Rust implementation.
- **`ext-data.c`**: Manages the per-connection state (`crsql_ExtData`) required by the extension.
- **`sqlite/`**: A copy of the SQLite amalgamation source. This is used for building test utilities and for creating statically linked artifacts.

### Rust Layer (`core/rs/`)

This directory contains the Rust crates that implement the core logic of `cr-sqlite`.

- **`crsql_bundle`** (inferred from `bundle_static` dependencies): This is the primary Rust crate containing the core conflict-free replicated data type (CRDT) logic, virtual table implementations, and data synchronization algorithms.

- **`crsql_bundle_static`**: This is a wrapper crate whose main purpose is to act as a build harness. Its `Cargo.toml` defines different features (`static`, `loadable_extension`) which control how the `crsql_bundle` crate is compiled for different targets. The `Makefile` directly invokes `cargo` on this crate.

- **`sqlite-rs-embedded`**: This git submodule provides `no_std` (standard library-free) Rust bindings to the SQLite C API. It is a critical component that enables `cr-sqlite` to be compiled for environments where the Rust standard library is not available, most notably Web Assembly. It is composed of several smaller crates:
    - `sqlite3_capi`: Uses `bindgen` to generate raw FFI bindings to the SQLite C API.
    - `sqlite3_allocator`: Provides a custom global allocator that uses SQLite's memory functions (`sqlite3_malloc`, `sqlite3_free`). This is essential for `no_std` environments.
    - `sqlite_nostd`: Provides safe, idiomatic Rust wrappers around the raw C API bindings.
    - `sqlite_web`: Provides shims and configurations needed for compiling to WASM.

## Build System (`Makefile`)

The entire project is orchestrated by `make`. The top-level `Makefile` is a simple wrapper that delegates to `core/Makefile`, which contains the detailed build logic.

### Build Process

The build process combines the Rust and C components into a single artifact. For a loadable extension, the steps are:

1.  **Compile Rust Code**: `make` invokes `cargo` to build the `crsql_bundle_static` crate. Cargo, in turn, compiles its dependency `crsql_bundle`. The `loadable_extension` feature flag is passed to `cargo`, which enables the correct build profile. The output is a static library (`libcrsql_bundle_static.a`).
2.  **Compile C Code**: `make` uses a C compiler (like `gcc` or `clang`) to compile the C source files in `core/src/`.
3.  **Link**: The C object files are linked against the Rust static library (`libcrsql_bundle_static.a`) to produce the final shared library file (e.g., `crsqlite.so`, `crsqlite.dylib`, `crsqlite.dll`).

### Build Artifacts

The build system can produce two primary types of artifacts:

1.  **Loadable Extension**: A shared library that can be dynamically loaded into a running SQLite instance using the `.load` command or `sqlite3_load_extension()` API.
    - **To build**: `make loadable`

2.  **Static Library**: An archive file (`.a`) that can be linked directly into an application at compile time. This bundles `cr-sqlite` with your application code.
    - **To build**: `make static`

The `Makefile` also includes targets for debugging (`make loadable_dbg`), testing (`make test`), and cross-compilation for platforms like iOS and Android.

## Web Assembly (WASM) Support

A key design goal of this project is to run in the browser as a Web Assembly module.

- **`no_std` Foundation**: The `sqlite-rs-embedded` submodule is the foundation for WASM support. By providing `no_std` bindings, it allows the Rust code to be compiled for the `wasm32-unknown-unknown` target, which does not have a traditional OS or standard library. The `sqlite_web` crate specifically provides the necessary shims (like a panic handler and global allocator) for a WASM environment.

- **WASM Compilation**: While the provided `Makefile`s focus on native builds, the project's structure is set up for WASM compilation. A separate build process (likely using a tool like `wasm-pack`) would compile the Rust code into a `.wasm` file.

- **Browser Integration**: The resulting `.wasm` binary, containing the `cr-sqlite` logic, can be used with browser-based SQLite implementations like `wa-sqlite`. `wa-sqlite` provides a Virtual File System (VFS) for SQLite that allows it to run in the browser, persisting data to IndexedDB or other browser storage. The `cr-sqlite` WASM module would be loaded as an extension into this `wa-sqlite` environment, providing its CRDT capabilities directly in the browser.

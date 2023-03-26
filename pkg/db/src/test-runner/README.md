# Librocco datamodel test runner

## TOC

1. [Motivation](#1-motivation)

2. [Structure](#2-structure):

    - 2.1. [New test runner](#21-new-test-runner)
    - 2.2. [Setting up the implementation](#22-setting-up-the-implementation)
    - 2.3. [Running the tests](#23-running-the-tests)
    - 2.4. [Running tests against multiple implementations](#24-running-tests-against-multiple-implementations)
    - 2.5. [Data loaders](#25-data-loaders)

3. [Usage](#3-usage):

    - 3.1. [Test modes](#31-test-modes)
    - 3.2. [Main test file](#32-main-test-file)
    - 3.3. [Writing tests](#33-writing-tests)
    - 3.4. [Benchmarks](#34-benchmarks)
    - 3.5. [Test scripts](#35-test-scripts)

## 1. Motivation

Due to the specific needs of librocco db package, we've developed a custom test runner.

The idea was to test the behaviour of the db interface, without getting into the implementation specific details. With this in mind, the tests should reflect our expectations of how the interface should behave, while it is up to each specific implementation to satisfy the behaviour (and pass the tests).

In order to achieve this, we should be able to write the test suite only once (and update only when the requirements for the standardised functionality updates, regardless of implementation) and run that suite against any or all specific implementations.

The test runner we came up with does exactly that, it allows us to take multiple implementations, iterate over them, load the test setup with specific implementation and run all of the unit tests against it.

## 2. Structure

### 2.1. New test runner

To start implementing the test suite, we would first load the test runner, like so:

```typescript
import { describe } from "vitest";

import { newTestRunner } from "@test-runner/runner";

// Notice the async callback of the describe block
describe("Datamodel tests", async () => {
    const runner = await newTestRunner(dataLoader);
});
```

Let's break this down:

1. The runner is built around vitest's API, so we start with the `describe` block (as we would a regular test suite). The callback has to be `async` as the test setup revolves around `async` functions (which we'd like to `await` before proceeding further)

2. We initialise the test runner using `newTestRunner` function. The `newTestRunner` function takes in a test data loader (more on data loaders below), loads the data (fixtures) using the loader and prepares it to pass to the next step.

_Note: the `newTestRunner` is `async` as the data loader performs a couple of async operations (e.g. reading from the fs, pulling the data from the db, etc.)_

### 2.2. Setting up the implementation

To create a test setup for a specific implementation, after initialising the runner, we use the `runner.setup` method, like so:

```typescript
import { describe } from "vitest";
import { newTestRunner } from "@test-runner/runner";
import { v1 as newDatabase } from "@/implementations";

describe("Datamodel tests", async () => {
    const runner = await newTestRunner(dataLoader);

    // Setup tests for v1 implementation
    const setup = runner.setup({ version: "v1", newDatabase });

    // ...run the tests
});
```

This step (after loading test data on test runner initialisation), initialises a test setup specific to the 'v1' implementation of the database interface.

Under the hood, when we've initialised the `runner`, we've passed in the data loader:

1. The `runner` was initialised, has loaded the test data using the loader and returned the `runner` object with `runner.setup` method.
2. The `runner.setup` method was ran, passing in the version string (`"v1"`) and the `newDatabase` function. This initialises the test setup, with methods `setup.test` and `setup.bench`. The setup was initialised in such a way that it keeps the test data and `newDatabase` in the closure and uses them to pass some additional props to each test run.

### 2.3. Running the tests

With the setup object (a test setup for a particular implementation) we can simply run `setup.test`, like so:

```typescript
import { describe } from "vitest";
import { newTestRunner } from "@test-runner/runner";
import { v1 as newDatabase } from "@/implementations";

describe("Datamodel tests", async () => {
    const runner = await newTestRunner(dataLoader);

    const setup = runner.setup({ version: "v1", newDatabase });

    // Run the test against the db interface set up by the runner
    setup.test("should do something", async (db, version, getNotesAndWarehouses) => {
        // Make assertions
    });
});
```

Let's break down the `.test` method:

-   The test method behaves similarly to vitest's `test` function as it serves as a wrapper around it: just like vitest's `test`, it accepts a name and a test callback, only caveat here is: the callback has to be `async` (which it always will be as we're testing async behaviour)
-   The test callback receives some additional parameters, provided by runner setup:
    -   the setup uses (specific implementation's) `newDatabase` (passed to `runner.setup`) to create a new `db` interface, with new database name, for each test, so the tests are parralelisable
    -   the setup passes the currently tested version string (`"v1"` in this case) to the test callback (in case we need it to prepend the doc ids with the version number, as is the current implementation)
    -   finally, `getNotesAndWarehouses` function is passed to the test callback (to be used if neccessary) to load the fixtures

### 2.4. Running tests against multiple implementations

Let's refactor our example to run the tests against multiple implementations.

One note: The db package is structured in such a way that each implementation exports a `newDatabase` function (for the interface to be instantiated), as a default export. Implementations are then collected in `index.ts` of `implementations` folder and exported as named exports (named after the implementation version), like so:

```typescript
export { default as v1 } from "./version1.1";
export { default as v2 } from "./version1.2";
```

We utilise that organisation to get both the name and the implementation factory function and pass that data to the tests, like so:

```typescript
import { describe } from "vitest";
import { newTestRunner } from "@test-runner/runner";

// Remember, implementations can be treated as a key/value object,
// - key being the implementation version string (e.g. "v1")
// - the value is the implementation's default export (i.e. 'newDatabase' function)
import * as implementations from "@/implementations";

describe("Datamodel tests", async () => {
    // We initialise the test runner on the same test data
    const runner = await newTestRunner(dataLoader);

    // Loop over the implementations and get a test setup for each
    Object.entries(implementations).forEach(([version, newDatabase]) => {
        // Let's add additional describe block for nicer test reporting
        describe(`Test ${version} implementation`, () => {
            // Setup has to be ran for each specific version
            // (passing in the version string and 'newDatabase' function)
            const setup = runner.setup({ version, newDatabase });

            // Run the test against the db interface set up for specific implementation
            setup.test("should do something", async (db) => {
                // Make assertions
            });

            setup.test("should do something else", async (db) => {
                // Make assertions
            });
        });
    });
});
```

Now what do we have here:

1. We've imported `implementations` as a key-value object
2. We've initialised the runner, passing in the test data loader (notice how the runner needs to be initialised only once)
3. We're looping over the implementations and running `runner.setup` for each implementation
4. We're running two tests for each implementation (`"should do something"` and `"should do something else"`)

All in all this is very similar to how our actual tests are set up.
In the following chapters, we'll go further over the db package structure, in terms of tests, explore different modes for testing/benchmarking and corresponding data loaders as well as see how we can utilise `getNotesAndWarehouses` function (passed to each test function).

### 2.5. Data loaders

Before going to actual usage, let's quickly go over the data loaders for test data (fixtures).

The test data loader is provided to the `runner` on initialisation: when the runner is initialised, it will load the test data (using the provided loader), transform the data to the right format (on `setup` step) and make that data avilable to the tests (through `getNotesAndWarehouses` passed to each test).

_Note: the transform step is unnecessary and will be omitted in the future when we rewrite our test data to the right format._

The loader must be an object with two methods:

-   getNotes - should return a list of notes in their chronological order
-   getSnaps - should return a list of snapshots of all of the warehouses, after each note has been committed

Currently we have two data loaders implemented:

-   fsDataLoader - loading the data from the fs (stored in .json format)
-   couchdbImageLoader - loading the data from the CouchDB container build from an image filled with test data

## 3. Usage

Now that we've been over the test runner structure, implementation and API, let's see how the actual testing is organised in our `db` package.

### 3.1. Test modes

There are multiple modes in which we can run the tests and they are controlled using env variables.

#### Quicktest vs. full test

As mentioned above, we have two data loaders, one loading the data from fs and one loading the data from the docker image (pulling the data from the container).

When using fs-only (fs loader), the test is considered a "quicktest", only unit tests are ran, without spinning up any docker containers.

_Note: quicktest only tests the base behaviour/methods/streams against a single, in-memory database, without any replication or remote db of any kind. This should really be used for quicktests, while tests with full docker support should be used to test the full behaviour._

For full testing (using CouchDB image loader), we need to have the container(s) running and for that we have the `docker-compose.yml` set up.

Additionally, running the tests with docker compose, we also replicate the test (in-memory) db to a CouchDB instance in the container. This provides for testing of replication, as well as easier debugging (as we can see the data in the db on `localhost:5000/_utils` CouchDB dashboard).

The prerequisite for running the latter (obviously) is running

```bash
docker compose up
```

but we also set the `FULL_TEST_SUPPORT` flag to `true` to notify the test suite that the containers are available and that it should run the tests accordingly.

_Note: to run full tests, including unit tests, as well as "stress tests" and benchmarks, we need to run the tests with full docker support._

#### Single implementation vs all implmentations

The test runner is set up with the ability to run the same tests against all implementations, with little additional code (compared to single implementation) and this would be a check we run from time to time to sync the behaviour of all different versions.

However, more often than not, we only want to test the specific implementation (namely the "current version"). This is also the test we use for CI checks, as in production we want to ensure the current version is working as expected.

The difference here is controlled through `TEST_MODE` end variable:

-   `TEST_MODE=all` (default) - run the tests against all implementations
-   `TEST_MODE=current-version` - run the tests only against current version of the db interface implementation

### 3.2. Main test files

As mentioned above, in the test runner example, our actual tests are set up in a way that's very similar to the code we used as an example. There's are a couple of small differences:

-   we have multiple test files:
    -   `test-runner/__tests__/runner.test.ts` - includes a (very simple) test suite for unit testing of the runner itself: **this should rarely be updated as the runner itself is developed and shoud only be updated if, for some reason, we decide to update the runner itself**
    -   `__tests__/main.test.ts` - the main logic of our test suite
    -   `__tests__/main.bench.ts` - the benchmark file (looks very similar to `main.test.ts`, but runs `setup.bench` rather than `setup.test` for each test case)
-   our `main.test.ts`, even though very similar to the example above, contains additional logic for controlling of the test modes (as described in [test modes section](#31-test-modes))
-   finally, our tests are not written in the test file itself (`main.test.ts`/`main.bench.ts`) as we want to be able to reuse some or all of the tests in different test suites, more below

### 3.3. Writing tests

Since we want to reuse some or all of the test cases across different suites (test/bench), we're not using the standard vitest-like api for tests, but are rather writing tests as named exported functions, like so:

```typescript
import { TestFunction } from "@/test-runner/types";

export const standardApi: TestFunction = async (db, version) => {
    // ...make assertions
};

export const stressTest: TestFunction = async (db, version, getNotesAndWarehouses) => {
    // ...make assertions
};
```

It is important to stick to this structure when writing tests as the test suites (main and bench files) are written in such a way that they import all tests from the test file as key-value objects, like so:

```typescript
import * as tests from "./tests.ts";
```

therefore, it's important that all of the exports from the `test.ts` file (in this example) are named exports of test functions. The test functions are handled (inside the test suite) something like this:

```typescript
// tests.ts
export const standardApi: TestFunction = async (db) => {
    expect(foo).toEqual(bar);
};

// main.test.ts
import * as tests from "./tests";

// ...runner and implementation setup

Object.entries(tests).forEach(([name, testFn]) => {
    // Notice how the test name is the name of the exported function (in this example: 'standardApi')
    // and the test callback is the exported function itself
    setup.test(name, testFn);
});
```

The result of this iteration (in this example, containing only one test) would evaluate to something like this:

```typescript
test("standardApi", async () => {
    expect(foo).toEqual(bar);
});
```

**Important: when writing tests, make sure to create a named export (the name of that export will be used as the name for the test case) and make sure that the test function itself satisfies `TestFunction` type (so that it can be passed to the test runner in a predictable way).**

One final thing to mention is the way our test files (files containing test cases) are organized:

-   `__tests__/tests.ts` - file containing unit tests for any db interface implementation
-   `__tests__/benchmarks.ts` - file containing tests cases, using the tests data (fixtures) and performing a large amount of operations (plus assertions after the operations are completed, ofc) to provide for benchmarks/stress tests - **still WIP**

The former contains the tests used to test out the base behaviour of the implementation (and are ran only in `main.test.ts` suite), while the latter is more focused on handling large data load, without going into some of the standard behaviour quirks, and is used in `bench.test.ts` as well as in `main.test.ts` (if in full test mode).

### 3.4. Benchmarks

Benchmarks are ran using vitest's `bench` function, and are currently ran on only one test case: uploading (and committing) 20 notes and asserting for the result.

_Note: benchmarking (as well as stress test for that matter) is still very much in WIP stage and we're making efforts to write more delatiled test cases, testing multiple updates, as well as replication, in a way that would provide for clear performance benchmarking._

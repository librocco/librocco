# @libroco/e2e

We're using [Playwright](https://playwright.dev/) for e2e tests.

## TOC

1. [Running tests](#1-running-tests)
    - [UI Mode](#11-ui-mode)
        - [Some problems with the Playwright UI](#111-some-problems-with-the-playwright-ui)
        - [Other tips](#112-other-tips)
    - [Run (headless) mode](#12-run-headless-mode)
    - [Debug mode](#13-debug-mode)
    - [Codegen](#14-codegen)
2. [Writing tests](#2-writing-tests)
    - [Querying the DOM and implicit element assertions](#21-querying-the-dom-and-implicit-element-assertions)
    - [Dashboard helpers API](#22-dashboard-helpers-api)
        - [Dashboard interface](#221-dashboard-interface)
        - [Main navigation interface](#222-main-navigation-interface)
        - [View interface](#223-view-interface)
        - [Sidebar interface](#224-sidebar-interface)
        - [Side link group interface](#225-side-link-group-interface)
        - [Content interface](#226-content-interface)
        - [Content heading interface](#227-content-heading-interface)
        - [State picker interface](#228-state-picker-interface)
        - [Scan field interface](#229-scan-field-interface)
        - [Entries table interface](#2210-entries-table-interface)
        - [Entries row interface](#2211-entries-row-inteface)
        - [Transaction field interface](#2212-transaction-field-interface)
        - [Book form interface](#2213-book-form-interface)
        - [Book from field interface](#2214-book-form-field-interface)
    - [Test setup](#23-test-setup)
        - [DB](#231-db)

## 1. Running tests

To start Playwright run, first start the app. In `@librocco/apps/web-client` run:

```sh
rushx start
```

When the app is running, we can run Playwright in different ways:

### 1.1 UI mode

**Command:**

```sh
rushx test
```

This is a preferred way of running Playwright during TDD or for quick debug sessions (in case test is failing due to latest update and we want to fix it).

This starts the Playwright UI. When started, tests can be ran by clicking `▶` button (either for the full suite or a particular test). By default, the watch mode is not active. To activate watch for a particular test or a suite, press the eye-like button next to the respective `▶` button.

The Playwright UI provides a very nice feature, called `pick locator`, allowing you to pick the element, visually (as if inspecting dev tools) and get the most precise locator to find the given element.

The UI will show us a lot of parameters for test runs:

-   **Actions**:
    -   located at the sidebar of the test run
    -   shows us the progress of the test with respect to the action ran
    -   by clicking action, the rest of the test run UI is updated to show parameters of the action being ran
-   **Browser window**:
    -   shows us the visual state of the app when each action is ran
-   **Source** tab:
    -   located at the bottom toolbar
    -   shows us the point in the test source code where the action originates from
    -   since we're not writing "pure" tests (actions are written in the `test` block directly), as that would produce a huge amount of code and repetition, and are using helpers api (providing abstractions on top of the test api) the source can be a bit misleading as it will show us the point in the function that initiated the action
    -   however general the source for an action can be (showing the point in the function initating the action), we can stil pinpoint the action in the test case by inspecting the **Call** tab
-   **Call** tab:
    -   located in the bottom toolbar
    -   shows us the action call - which action has been called and what it has been called with
    -   this can be used to more precisely locate where the failing action occured
    -   finally, Call tab provides extensive logs for the action (trying to access the element, when the element is visible, trying to click the element, etc.)
-   **Console** tab:
    -   shows the console of the app at certain point in time (coninciding with the given action)
    -   **this isn't the console of test code and if test code logs something to console, it won't be shown in the Playwright UI**

#### 1.1.1 Some problems with the Playwright UI

The Playwright UI is still in experimental stage, however stable, it has certain drawbacks:

-   the Playwright UI window might get lost in the open apps (I don't know if this is a Mac-only thing), even though the test process is still running - in that case, simply restart the test process (this should be much quicker than starting Cypress so it's not a huge bug)
-   sometimes the failures won't be shown in the UI:
    -   if the test fails due to an error being thrown (inside the test code), it might or might not show that error in the UI
    -   the failures are always displayed in the list of ran tests, so tests are still reliable, but the reason for failure is sometimes a bit puzzling
    -   if test is failing for no apparent reason, we can run the tests in test run mode - either fully headless or debug mode and inspect the logs during such runs - there the logs from test code (as well as errors) will be shown

#### 1.1.2 Other tips

-   the tests run on Chromium by default, but we can change that by clicking `Projects: chromium` in the top left corner of the UI (expaning to preferences area, allowing us to pick any and all browsers to run the tests on)

[See more](https://playwright.dev/docs/test-ui-mode)

### 1.2 Run (headless) mode

**Command:**

```sh
rushx test:run
```

This starts the one-off Playwright test run. It runs all of the tests and run s them for Chromium, Mozilla and Webkit browsers. This is a full test suite and there's probably no reason to run this other than, maybe, as a last verification that absolutely everything works, or in CI, where this is the preferred way of running the tests.

_It might, however, be helpful to run this with 'test.only' in case we're inspecting logs for weird test failures (as mentioned in the previous section)._

### 1.3 Debug mode

**Command:**

```sh
rushx test:debug
```

Additionally, if we want to run the specific test, we can do

```sh
rushx test:debug <test-name>
```

This is a combination of test run and the UI - it runs the same way it would for test run, but it opens a debug window, showing the browser interactions in real time.

[See more](https://playwright.dev/docs/debug#run-in-debug-mode)

### 1.4 Codegen

**Command:**

```sh
rushx test:codegen
```

A useful feature which can record your actions and generate a test code. It's not perfect, but can be a convenient starting point to build from.

[See more](https://playwright.dev/docs/codegen-intro)

## 2 Writing tests

### 2.1 Querying the DOM and implicit element assertions

Two main concepts, when making assertions (or simply querying the DOM) are locators and references:

-   **locators:**
    -   unlike Cypress, which works only with references, Playwright utilises the concept of locators. Locators are like slightly more extensive selectors - they store the instruction on how to find the specific element
    -   stemming from the fact that the locator is an instruction, rather than reference, the locator, when constructed, doesn't do anything with the DOM and we can construct a locator for an element that doesn't yet exist in the DOM wihout any problems
    -   as stated, constructing the locator doesn't make any implicit assertions, so, if we wanted to assert that the element is visible in the DOM, we do so explicitly by using the `.waitFor` method - this retries the query (as instructed by the locator) until the locator exists and is accessible in the DOM
    -   regardless of locators being instructions, rather than references, the Playwright API allows us to interact (with the DOM) using locators, e.g. `locator.click()` - every time we perform an action on the locator, a new query to the DOM is made and action is performed against the returned element - this reduces a lot of the flakiness related to interacting with the DOM in Cypress (where hard references to a specific element instance are kept)
    -   locators can be chained off of one another, where each chained method queries desendants inside the locator it has been chained off of
    -   finally, locators can be constructed:
        -   using `.locator` method and passing it a CSS selector - `page.locator("button[type=submit]")`
        -   using `@testing-library`-like selectors - `page.getByRole("button")`
-   **references:**
    -   sometimes we need to interact with the DOM and the elements directly so we have to use the "hard" references
    -   this is most often the case when we want to get all of the elements matched by the given locator (running `locator.all`) or running `page.evaluate` or `page.waitForFunction` which interact with the DOM using vanilla JS
    -   be careful when using "hard" references as elements can sometimes change mid way or the snapshot might be taken before the expected change happens and assertions won't be reran with the updated DOM - to remedy this it's a good idea to wait for the desired "setup" (element appearing/changing/dispappearing from the DOM) before making snapshot assertions
-   **interacting with objects in browser context:**
    -   the simplest way of interacting with the objects in the browser context is using `page.evaluate` which is simple and straightforward way to interact if we're passing serialisable values to the callback
    -   if we, however, want more advanced interactions, we use the `page.evaluateHandle` which returns a `JSHandle` - an object keeping reference to the object in the browser context, with some helpful methods, the most useful one being `(JSHandle).evaluate` where we can pass a callback the same way we would when using `page.evaluate`, with the difference that the first argument passed to the callback is the given object in the browser context (we're using this to interact with the db interface in the browser context, more below)

### 2.2 Dashboard Helpers API

Since our app is a dashboard one with views being laid out in almost the exact same way, while working on tests, we've come up with a light utility API that allows us to reduce code repetition by keeping locators for specific elements/areas of the page and exposing additional helpers (constructing an interface around a specific element locator).

#### 2.2.1 Dashboard interface

Dashboard interface is the entry point of our helpers api. It exposes some helpful methods as well as ways to access other interfaces, communcating with specific parts of the dashboard.

We initialise the dashboard with `getDashboard` function, passing to it the `page` object (received from test function context)

**Methods:**

-   **waitFor:**
    -   a way to wait for the dashboad to be loaded (by asserting the "All" warehouse is available im the sidebar - our default view)
    -   it's a good idea to `await` this before any other interactions (including db setups)
-   **nav:**
    -   access the [main navigation interface](#222-main-navigation-interface)
-   **navigate:**
    -   runs `.navigate` on the [main navigation interface](#222-main-navigation-interface)
-   **view:**
    -   accepts view name and constructs the [view interface](#223-view-interface)
-   **sidebar:**
    -   constructs the [sidebar interface](#224-sidebar-interface)
-   **content:**
    -   constructs the [content interface](#226-content-interface)
-   **bookForm:**
    -   constructs the [book form interface](#2213-book-form-interface)

#### 2.2.2 Main navigation interface

Used to interact with the main navigation, in the header, used for switching views.

Other then its own methods, it extends the Locator interface (locator for the container element).

**Methods:**

-   **navigate:**
    -   accepts the view name
    -   clicks the link to the desired view
    -   under the hood, it uses dashboard [view](#223-view-interface) to wait for the navigation to complete
    -   **it's atomic if awaited** - we're sure the navigation is complete afterwards (if navigation doesn't happen/complete it will fail)

#### 2.2.3 View interface

A locator for the container element holding the entire view (the entire non-header section of the dashboard). It is matched by `data-view`, assigned to each view container. As such, we can use the methods on the locator interface, most notably `.waitFor` - providing us with assurances that the view is loaded (or navigated to)

#### 2.2.4 Sidebar interface

Sidebar interface is used to interact with the view sidebar (found at the left hand side of the app). It extends the locator interface (locator for the container element) as well as exposing some additional methods for sidebar interaction.

**Methods:**

-   **createWarehouse:**
    -   clicks "Create warehouse" (to be used in stock view) creating a new warehouse
    -   afterwards it waits to be redirected to the newly created warehouse as well as the warehouse being displayed in the sidebar
    -   **it's atomic if awaited** - we're sure the warehouse creation has made the full round trip and we're redirected to the given warehouse's view
-   **createNote:**
    -   clicks "Create note" (to be used in outbound view) creating a new outbound note
    -   afterwards it waits to be redirected to the newly created note as well as the note being displayed in the sidebar
    -   **it's atomic if awaited** - we're sure the note creation has made the full round trip and we're redirected to the given note's view
-   **link:**
    -   accepts the label of the link and creates a locator for that link (inside the sidebar)
    -   we can then `.waitFor` the link to become available (if waiting for the link to appear after warehouse/note creation) or `.click` it for navigation
    -   **link click** is not atomic - we can't assume the link has been executed after awaiting (only that it has been clicked)
-   **assertLinks:**
    -   checks links available in the sidebar
    -   it will retry the assertion until passed or timed out
-   **assertGroups:**
    -   to be used in inbound note view
    -   checks expandable link groups available (named after the button used to open them, i.e. warehouse name) against an array provided as argument (checks button labels - warehouse display names)
    -   it will retry the assertion until passed or timed out
-   **linkGroup:**
    -   accepts a label (name) of the link group as a parameter
    -   constructs a [side link group interface](#225-side-link-group-interface)

#### 2.2.5 Side link group interface

Side link group interface keeps a locator for the expandable link group (in inbound note view), found by the label on the expand-group button. It exposes the locator to the container element as well as some additional methods for interaction with (expandable) link groups.

**Methods:**

-   **open:**
    -   expands the link group
    -   works idempotently - noop if the group is already expanded
    -   _other methods expand the group (under the hood) before interaction_
-   **createNote:**
    -   clicks "Create note" (to be used in inbound view) creating a new inbound note under the specific warehouse
    -   afterwards it waits to be redirected to the newly created note as well as the note being displayed in the sidebar
    -   **it's atomic if awaited** - we're sure the note creation has made the full round trip and we're redirected to the given note's view
-   **link:**
    -   accepts the label of the link and creates a locator for that link (inside the sidebar)
    -   we can then `.waitFor` the link to become available (if waiting for the link to appear after warehouse/note creation) or `.click` it for navigation
    -   **link click** is not atomic - we can't assume the link has been executed after awaiting (only that it has been clicked)
-   **assertLinks:**
    -   checks links available in the current link group
    -   it will retry the assertion until passed or timed out

#### 2.2.6 Content interface

Content interface is the locator to the content section of the dashboard (everything that's not the header, sidebar nor book form). It is extended with a couple of additional methods, used to access interfaces for interaction with different parts of the content section.

**Methods:**

-   **heading:**
    -   constructs [content heading interface](#227-content-heading-interface)
    -   it accepts `title` and `opts` (both optional)
    -   if `title` provided, it locates the `h2` title, inside the content container, containing the `title` as text value
    -   if `title` not provided, it merely locates the `h2` inside the content container
    -   `opts` are options passed to `(Locator).getByText`
-   **updatedAt:**
    -   locates the "Last updated: ..." text (in note heading), extracts the date string and parses into the JS `Date` object
    -   resolves to said `Date` object
-   **assertUpdatedAt:**
    -   asserts that the `updatedAt` value (extracted from the note heading) matches the provided date
    -   it allows for a minute (60000ms) error, for more organic tests (without mocking the date)
-   **statePicker:**
    -   constructs the [state picker interface](#228-state-picker-interface)
-   **scanField:**
    -   constructs the [scan field interface](#229-scan-field-interface)
-   **entries:**
    -   constructs the [entries table interface](#2210-entries-table-interface)
    -   accepts the `view` parameter - "inbound" | "outbound" | "stock" as the entries table behaviour is slightly different across views

#### 2.2.7 Content heading interface

Content heading interface is a locator to the `h2` heading in the content section. As such it extends the Locator inteface with some additional methods.

**Methods:**

-   **getTitle:**
    -   returns the text content of the title element
    -   accepts (optional) `opts` parameters (`.waitFor` options) - including only the timeout
    -   **it the title is not received within the given timeout, it doesn't fail** as a lot of the times we want to get the title text (if it exists) - in that case it resolves to an empty string
-   **rename:**
    -   accepts one parameter - a new title
    -   clicks on the title (converting it into the input field), fills with the new title and submits
    -   **it's atomic if awaited** - it waits for the update to be shown in the sidebar (ensuring it made the full round trip)

#### 2.2.8 State picker interface

State picker interface is a locator to the state picker element (in note view). It exposes all of the locator methods with some additional methods for interaction with the note state.

**Methods:**

-   **getState:**
    -   returns the current state (in the picker)
-   **assertState:**
    -   accepts note state or note temp state and asserts that state is in the picker (waits for pass or timeout)
-   **select:**
    -   accepts note state, opens the picker and selects the given state
    -   **it doesn't wait for the state change** as delete and commit states result in redirection (which would dead-lock the test)

#### 2.2.9 Scan field interface

Scan field interface is a locator for the (isbn) scan field. As such, it exposes the methods of the Locator interfce (already including the `.fill` method) with some additional methods.

**Methods:**

-   **add:**
    -   accepts the isbn and adds the transaction with the given isbn to the note - simulating the act of scanning a barcode
    -   it does so without opening the book form
-   **create:**
    -   clicks on the `Create` button, opening the book form

#### 2.2.10 Entries table interface

Entries table interface is a locator to the entries table in the content section, extended with methods for accessing the rows or performing the full assertions of rows displayed.

**Methods:**

-   **row:**
    -   accepts a (0-based) row index and constructs the [entries row interface](#2211-entries-row-inteface) for the given row
-   **assertRows:**
    -   asserts the full state of the rows in the table
    -   accepts an array of partial DisplayRow values
    -   asserts that the rows in the table contain values specified by the `rows` param in the exact order, with no more nor less rows displayed
    -   accepts (optional) `{ strict: boolean }` options
    -   if `strict: true` the rows have to have the exact same values (with respect to the view) as the ones provided in `rows` param, where each incomplete row is filled with the default values
    -   if `strict: false` runs assertions for rows, only for the properties provided in the `rows` param for each row (with respect to the view)
    -   more on field assertions in [entries row interface](#2211-entries-row-inteface)
    -   retries the assertions until passed or timed out
-   **selectAll:**
    -   checks the checkbox in the heading row (checking all of the rows' checkboxes)
    -   **it works idempotently** - noop if the checkbox is already checked
-   **unselectAll:**
    -   unchecks the checkbox in the heading row (unchecking all of the rows' checkboxes)
    -   **it works idempotently** - noop if the checkbox is already unchecked
-   **deleteSelected:**
    -   clicks the `Delete` button in the header row, deleting the selected transactions
    -   _it doesn't wait for the selected rows to be deleted_

#### 2.2.11 Entries row inteface

Entries row interface is a locator to a particular row in the table. It exposes some additional methods for interactions/assertions related to the row. Additionally, the `view` parameter (passed in while constructing the [content interface](#226-content-interface)) is passed down to the row interface so as to run assertions only on the fields available in the specific view (skipping the rest).

**Methods:**

-   **field:**
    -   accepts a `name` param and constructs a [transaction field interface](#2212-transaction-field-interface) with respect to the name
-   **assertFields:**
    -   accepts `row` (partial display row object) and `{ strict: boolean }` opts
    -   if `strict: true` it constructs the display row from the `row` passed in and the default values for the fields not passed in
    -   if `strict: false` it asserts only the fields found in the `row` param
    -   regardless of `strict` being true or false, only matches the values displayed in the row for a specific view (hence the internal passing down of `view` value)
-   **select:**
    -   selects a single row by checking the box in the beginning of the row
    -   **it works idempotently** - noop if the checkbox is already checked
-   **unselect:**
    -   unselects a single row by unchecking the box in the beginning of the row
    -   **it works idempotently** - noop if the checkbox is not checked

#### 2.2.12 Transaction field interface

**Methods:**

-   **assert:**
    -   asserts that the given field has the same value
    -   each field has a different way of handling this so this way we're exposing the consistent API, regardless of possibly differing functionality
    -   retries until pass or timeout
-   **set:**
    -   **only the following fields have this method:** quantity, warehouse name (also changes warehouseId, through the UI)
    -   accepts the `value` param (appropriate type for the field) and sets the value in a way that's specific to the field
-   **assertOptions:**
    -   **only the following fields have this method:** warehouse name
    -   accepts a list of options (labels) and asserts is against the options in the picker

#### 2.2.13 Book form interface

Book form interface is a locator for the book form, displayed in the slideover. It can be constructed at any time (being a simple locator), but all of the actions will fail if the book form is not opened (by clicking `Create` button on the scan field or `Edit` button in the transaction row).

**Methods:**

-   **field:**
    -   accepts a `name`
    -   constructs a [book form field interface]
-   **fillBookData:**
    -   accepts the full book data (some fields are optional)
    -   fills in all the provided fields
-   **fillExistingData:**
    -   if the book data should already exist, it confirms the prompt to fill in the existing book data
-   **submit:**
    -   submits the form
    -   accepts `kind` param - either `click` (submits by clicking the `Save` button) or `keyboard` (default, press `Enter` to submit the form)
    -   even though `keyboard` is default submit kind, we've found that it doesn't work for some browsers, so all submissions are done with `click` (imperatively) while we investigate the cause for failures
    -   **after submission it waits for the form to be removed from the screen**

#### 2.2.14 Book form field interface

Book form field interface is a locator constructed for a specific field. Other than Locator methods it has a single `set` method.

**Methods:**

-   **set:**
    -   accepts the value (only the correct type for the field) and sets the field to that value
    -   each field (constructed using the name) has a specific way of handling the `.set` under the hood - providing for a consistent api, with different functionalities where necessary (e.g. publisher select)

### 2.3 Test setup

#### 2.3.1 DB

To set up the db, we can't interact with the db directly as db is available in the browser context, whereas the test code (aside from actions) is executed outside the browser context. To remedy this, we use the `page.evaluateHandle` to construct the db handle. The db handle can then be evaluated to execute the code inside the browser environment with access to the db interface.

To construct the db handle run:

```ts
import { getDbHandle } from "<root>/helpers";

// Inside the test case
const dbHandle = await getDbHandle(page);
```

To run any action against the db interface (for db setup), simply run:

```ts
dbHandle.evaluate((db) => {
    // ...
});
```

One caveat: `dbHandle.evaluate` is run in the browser context, same as `page.evaluate` with the difference of `dbHandle.evaluate` having access to the `db` object (passed as first param to the `.evaluate` callback). If we want to reference any additional variables from the test context, we need to pass them as additional params to the `dbHandle.evaluate` and access them as params to the callback, e.g.:

```ts
const book = { ...bookData };

const dbHandle = await getDbHandle(page);

// Store the book data into the db
await dbHandle.evaluate(async (db, book) => {
    await db.books().upsert([book]);
}, book);
```

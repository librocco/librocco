# @libroco/e2e

We're using [Playwright](https://playwright.dev/) for e2e tests.

To start Playwright run, first start the app. In `@librocco/apps/web-client` run:

```sh
rushx start
```

And then, from `@librocco/apps/e2e` run:

```sh
rushx test
```

This starts the Playwright UI. When started, tests can be ran by clicking `▶` button (either for the full suite or a particular test). By default, the watch mode is not active. To activate watch for a particular test or a suite, press the eye-like button next to the respective `▶` button.

The Playwright UI provides a very nice feature, called `pick locator`, allowing you to pick the element, visually (as if inspecting dev tools) and get the most precise locator to find the given element.

_Note: The Playwright UI is still in experimental stage, however stable, so some small bugs might be encountered. One such bug is that, the Playwright UI window might get lost in the open apps (I don't know if this is a Mac-only thing), even though the test process is still running. In that case, simply restart the test process._

Another useful feature is the Playwright [codegen](https://playwright.dev/docs/codegen-intro) which can record your actions and generate a test code. It's not perfect, but can be a convenient starting point to build from. To run codegen, run:

```sh
rushx test:codegen
```

## Querying the DOM and implicit element assertions

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
    -   this is most often the case when we want to get all of the elements matched by the given locator (running `locator.all`) or runnint `page.evaluate` or `page.waitForFunction` which interact with the DOM using vanilla JS
    -   be careful when using "hard" references as elements can sometimes change mid way or the snapshot might be taken before the expected change happens and assertions won't be reran with the updated DOM - to remedy this it's a good idea to wait for the desired "setup" (element appearing/changing/dispappearing from the DOM) before making snapshot assertions

## Utils

Since our app is a dashboard one with views being laid out in almost the exact same way, while working on tests, we've come up with a light utility API that allows us to reduce code repetition by keeping locators for specific elements/areas of the page and exposing additional helpers (constructing an interface around a specific element locator).

### API

#### SideNav

`SideNav` interface keeps a locator for the sidebar (found at the left hand side of the app) and exposes the following methods:

-   `waitFor` - simply exposes the underlaying locator's `waitFor` method
-   `createWarehouse` - clicks "Create warehouse" (to be used in stock view) creating a new warehouse
-   `createNote` - clicks "Create note" button (to be used in outbound view) creating a new outbound note
-   `link` - accesses a link with the label (provided as argument), as a locator, which we can `.click` or `.waitFor`
-   `assertLinks` - checks links available at this point in time, against an array provided as argument (checks only labels)
-   `assertGroups` - (to be used in inbound note view) checks expandable link groups available (named after the button used to open them, i.e. warehouse name) against an array provided as argument (checks button labels - warehouse display names)
-   `linkGroup` - used to access a `LinkGroup` interface for a given link group (e.g. "All", "Warehouse 1", etc)

`LinkGroup` interface keeps a locator for the expandable link group (in inbound note view), found by the label on the expand-group button, API:

-   `waitFor` - simply exposes the underlaying locator's `waitFor` method
-   `open` - an idempotent way of expanding the group - if the group is not expanded, clicks the expand button, noop otherwise (other methods expand the group under the hood, before give interation)
-   `createNote` - clicks "Create note" button creating a not in the given warehouse
-   `link` - accesses a link with the label (provided as argument), as a locator, which we can `.click` or `.waitFor`
-   `assertLinks` - checks links available at this point in time, against an array provided as argument (checks only labels)

_...more to come_

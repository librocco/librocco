# @librocco/shared

This package contains some structures and utils used througout the monorepo.

## Contents

1. [Debug context](#1-debug-context)

2. [Test Utils](#2-test-utils)
    - 2.1. [Wait for](#21-wait-for)

## 1. Debug context

Debug context is a simple, yet powerful structure used to get logs for specific dataflow, throughout the entire app.

### The problem

Somethimes we want to debug the entire flow of data, being, for instance an RxJS pipeline. If we had single, clear, data flow from source to destination, the debugging would be trivial: We could simply `.pipe(tap(console.log))`, like so:

```typescript
import { from, map } from "rxjs";

// Source observable
const source = from(someEventSource).pipe(
    tap((val) => console.log("source_stream:input_value: ", val)),
    map(someMappingFunction),
    tap((val) => console.log("source_stream:mapped_value: ", val))
);

// Destination
source.pipe(tap((val) => console.log("subscriber:received_value: ", val))).subscribe(() => {
    /* Do something */
});
```

In this case the logging is trivial and we can track the logs of everything streamed from the source, through the pipeline, all the way to the subscriber. There is a simple problem though: If we wanted to "turn on" the logging, we'd have to manually add each `.tap` and `console.log` each time.
This would be tiring as it is, but it's not the main problem.

Imagine a second case where we use functions to construct parts of the pipeline (the example is purposefully trivial, but it's an oversimplification of a flow we use in production):

```typescript
import { Observable, tap } from "rxjs";

// Creates observable stream from an even emitter (emitting numbers in this case).
function observableFromEvent(e: EventEmitter<number>) {
    return new Observable((s) => {
        e.on("event", (val) => s.next(val));
    });
}

// Takes in an observable stream, streaming numbers, pipes it
// through a map function adding 1 to each value and returns the resulting stream.
function mapAddOne(o: Observable<number>) {
    return o.pipe(map((v) => v + 1));
}
```

Now let's say we use those functions to create two streams:

```typescript
// Let's say (for some crazy reason) we want to stream the sum of each prime number
// and the number in fibonacci sequence of the same index, incremented by 1.
//
// We start with two event emitters:
// - one emits prime numbers, at random interval
// - another one emits numbers from fibonacci sequence, at random interval
//
// Create streams from event emitters
const primeNumberStream = observableFromEvent(primeNumberEmitter);
const fibonacciStream = observableFromEvent(fibonacciEmitter);

// Create a stream streaming numbers from fibonacci sequence, incremented by 1
const fibPlusOneStream = mapAddOne(fibonacciStream);

// Combine the two streams
const primePlusFibPlusOneStream = combineLatest(primeNumberStream, fibPlusOneStream).pipe(map(([prime, fib]) => prime + fib));
```

If something fails in the `resultStream`, we can debug the flow by adding `console.log` to each step of the way, both in functions, as well as in the result stream, like so:

```typescript
// Add logging to the functions
function observableFromEvent(e: EventEmitter<number>) {
	return new Observable((s) => {
		e.on('event', (val) => {
			console.log('observable_from_event:event', val);
			s.next(val);
		});
	});
}

function mapAddOne(o: Observable<number>) {
	return o.pipe(
		tap((val) => console.log('map_add_one:input', val)),
		map((v) => v + 1),
		tap((val) => console.log('map_add_one:result', val))
	);
}

// ...rest of the code

// And in the result stream
const primePlusFibPlusOneStream = combineLatest(primeNumberStream, fibPlusOneStream).pipe(
    tap((val) => console.log("prime_plus_fib_plus_one:inputs", val)),
	map(([prime, fib]) => prime + fib)
    tap((val) => console.log("prime_plus_fib_plus_one:result", val)),
);
```

This is fine as we can now see logs for each step of the way, but what happens if we take a step back and add additional stream, this one streaming even numbers.

```typescript
// Let's say we have an even number emitter, emitting even numbers at a random interval
const evenNumbersStream = observableFromEvent(evenNumberEmitter);
```

Say we see the `primePlusFibPlusOneStream` is off (and indeed it is, but let's not get sidetracked with rxjs transformers).

If we wanted to debug this, we could set up our `console.log`s like before. Now, however, `evenNumbersStream` also uses `observableFromEvent` to construct part of the pipeline, so we have three observables constructed using `observableFromEvent` and, if we add logging like so:

```typescript
function observableFromEvent(e: EventEmitter<number>) {
    return new Observable((s) => {
        e.on("event", (val) => {
            console.log("observable_from_event:event: ", val);
            s.next(val);
        });
    });
}
```

...the problem is: each time one of our three event emitters (`primeNumberEmitter`, `fibonacciEmitter`, `evenNumberEmitter`) emits, we would get a log:

```console
observable_from_event:event: <some-value>
```

This can be problematic as:

1. Each time an event is emitted, both from event emitters we care about (`primeNumberEmitter`, `fibonacciEmitter`) and the emitter we don't care about (`evenNumberEmitter`), the value is logged to the console, cluttering the console with unnecessary logs
2. There's no way to tell which data flow (pipeline) the log belongs to (as the function can be called to construct an observable from any event emitter and will always log `observable_from_event:event:` + value itself)

You can only imagine that, as we add more and more streams/data flows using the same helper functions to custruct parts of the pipeline, open/close db subscriptions, convert the streams to svelte stores (for UI), it would make it impossible to debug, with all of the unwanted messages getting logged to the console.

### The solution

To recap, we wanted to create a solution which would:

1. Allow us to lay out the debug/logging points in the data flow, but leave us the ability to "turn them off and on" in a single place.
2. Give us the ability to differentiate which data flow the logs belong to.

The solution we came up was to create a context object, passing `debug` boolean flag to each function along the way, and log only the messages for the flows which have `debug: true` context.

First we pass the debug context object to all of the functions, and have that context be passed to all subsequent steps creating the data flow, e.g.:

```typescript
// Accepts and event emitter and debug context object, and starts the stream from the events emitted by the emitter.
function streamFromEvent(e: EventEmitter, ctx: debug.DebugCtx) {
    return someStream;
}

// Accepts an event emitter and the context, and passes both to `streamFromEvent`
function streamEventWithMappedValue(e: EventEmitter, ctx: debug.DebugCtx) {
    return streamFromEvent(ctx).pipe(map(someManipulation));
}

// Start the new stream with the context of { debug: false }
const stream = streamEventWithMappedValue({ debug: false });

// Start another stream with another context (also { debug: false })
const anotherStream = streamEventWithMappedValue({ debug: false });
```

With the context being passed throughout the entire data flow, we can simply turn it on or off at the initial step of the flow (switch debug to `true` for any of the streams), so if we want to debug only the first stream we can switch only its context to `{ debug: true }`, like so:

```typescript
// We want to debug only this stream and show all the logs in the data flow
const stream = streamEventWithMappedValue({ debug: true });

// Even though this stream uses the same functions to create the pipeline,
// its context has `{ debug: false }` so we won't see any logs for its data flow
const anotherStream = streamEventWithMappedValue({ debug: false });
```

Next, we need to add logging itself. For that we have the `log` method.
The `debug.log` method takes in the context and the "step" (a string name for the step in the data flow), and returns a logger: a function curried with `ctx` and `step` which takes in any value, constructs the message (from the context and the step) and logs the message + (the value accepted as paremeter) to the console **only if debug: true**:

```typescript
import { debug } from "@librocco/shared";

function streamFromEvent(e: EventEmitter, ctx: debug.DebugCtx) {
    return new Observable((s) => {
        e.on("event", (val) => {
            // Maybe log to the console (if ctx.debug:true)
            // The log will look like this:
            // stream_from_event:event: <val>
            debug.log(ctx, "stream_from_event:event: ")(val);
            // Stream the value
            s.next(val);
        });
    });
}

function streamEventWithMappedValue(e: EventEmitter, ctx: debug.DebugCtx) {
    return streamFromEvent(ctx).pipe(
        // Maybe log the value received from the stream
        tap(debug.log(ctx, "stream_map:input: ")),
        // Manipulate the stream
        map(someManipulation),
        // Log the result
        tap(debug.log(ctx, "stream_map:res: "))
    );
}

const stream = streamEventWithMappedValue({ debug: true });
const anotherStream = streamEventWithMappedValue({ debug: false });
```

Now, since only the first stream pipeline has `debug: true`, only the values from that pipeline will be logged to the console, like so:

```console
stream_from_event:event: <value streamed from emitter>
stream_map:input: <value received from 'streamFromEvent'>
stream_map:res: <mapped value>
```

Finally, the debug context object also accepts the `name` property, so we can identify the data flow more easily (in case of debugging the relationship between two, somewhat, connected data flows):

```typescript
const stream = streamEventWithMappedValue({ name: "[STREAM_1]", debug: true });
const anotherStream = streamEventWithMappedValue({ name: "[STREAM_2]", debug: false });
```

Will print the following to the console:

```console
[STREAM_1]:stream_from_event:event: <value streamed from emitter>
[STREAM_1]:stream_map:input: <value received from 'streamFromEvent'>
[STREAM_1]:stream_map:res: <mapped value>
```

This is quite a simple implementation right now, but it allows us to build on it and add enhancements, like tracking the branching of streams (if two streams converge into one and we want to know the full data flow, but also differentiate the two streams, before they're merged). We would also add the functionality to pick up all of the logs and then list only the relevent ones, and so on, but those are possible enhancements which may or may not be necessary, for now it provides a convenient way of debugging complex data flows: streams, events, db updates and so on...and has already helped immensely, while debugging the app data flows (from client app all the way to db streams, and back).

## 2. Test Utils

### 2.1. Wait for

Wait for is a test util which will return a promise, retrying an operation in an interval of 50 ms, until the operation is successful (at which point it will resolve) of the timeout has been reached.

We can use this for async test assertions when we're expecting some value to get updated at some point, without a way to explicitly `await` the update.

It's quite similar to `@testing-library/(react | svelte)`'s `waitFor` in its behaviour, but, unlike testing libaray one, this one is pure JS and doesn't depend on JS-dom, so it can be used in node environment as well.

Usage:

```typescript
// Create a stream
const stream = createStream();
// Create a var which will house the latest value from the stream
// and be used to test the stream's behaviour.
let testValue;
// Update the 'testValue' on each stream.
stream.subscribe((val) => {
    testValue = val;
});
// Do an update, which should trigger a new value to be streamed.
await updateWhichTriggersAStream();
// Now, we cant await anything as the operation above will do something and
// some logic might do something in the background and stream the value we're expecting, AT SOME point...
// So we use our 'waitFor' to assert the value was streamd in a reasonable amount of time:
await waitFor(() => {
    expect(testValue).toEqual(wantValue);
});
```

In the above example, if the `waitFor` callback throws an error (either a failed assertion, or a different error), it will retry until timeout:

-   the first time it's executed without error (all assertions are passing), it will resolve
-   if timeout is reached, it will reject with the error thrown from the latest attempt (allowing for clear error reporting)

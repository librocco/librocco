import { inChunks } from "../utils.ts";
import { assertEquals } from "https://deno.land/std@0.140.0/testing/asserts.ts";


const testIterable = {
    async* [Symbol.asyncIterator]() {
        for (let i = 0; i < 10; i++) {
            yield i;
        }
    }
}

Deno.test("inChunks", async () => {
    const chunks = [];
    for await (const chunk of inChunks(testIterable, 3)) {
        chunks.push(chunk);
    }
    assertEquals(chunks, [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [9],
    ])
});

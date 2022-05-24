import { BufReader } from "https://deno.land/std/io/buffer.ts";


/**
 * Aggregate values from an Iterable in chunks of a given maximum size
 * @param {Iterator} sequence The iterator to take values from
 * @param {Number} chunkSize - The size of the chunks
 * @return {Iterator} - An iterator over the chunks
 */
export const inChunks = async function* <T>(
    sequence: AsyncIterable<T>,
    chunkSize: number,
) {
    let chunk = [];
    for await (const element of sequence) {
        chunk.push(element);
        if (chunk.length === chunkSize) {
            yield chunk;
            chunk = [];
        }
        yield chunk;
    }
};


export const rowToObjectMaker = function (columns: string[]) {
    return async function (row: AsyncIterable<string>) {
        let obj: { [key: string]: string } = {};
        let i = 0;
        for await (const field of row) {
            obj[columns[i]] = field;
            i++;
        }
        return obj;
    };
}

/**
* Counts lines in a csv file for progress bar calculations
* @param {string} filePath - csv file path
* @return {Number} - Number of lines in file
*/
export const howManyLines = async function (filePath: string) {
 let lineCount: number = 0;
 var file;
 try {
   file = await Deno.open(filePath);
   const bufReader = new BufReader(file);
   while (await bufReader.readLine()) {
     lineCount++;
   }
 } finally {
   if (file) file.close();
 }
 return lineCount;
};

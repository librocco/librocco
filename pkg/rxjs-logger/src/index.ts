import { newLogger } from "./logger";

const logger = newLogger();

/**
 * This operator should be called at the very beginning of the pipeline (if we want to capture it in its entirety), it:
 * - registers the pipeline (if not already registered)
 * - generates a transmission id and registeres a new transmission (each time value is emitted from the origin)
 * - wraps the "pure" value from the origin with meta used for logging (pipeline and transmission ids) and transmits
 * the value with meta further down the pipeline
 * @param pipelineId
 * @param generateId a function used to generate the id for each new transmission, it gets passed an initial value,
 * emitted from the origin. Defaults to a timestamp function (generating id as string converted unix timestamp)
 * @returns
 */
export const start = logger.start;

/**
 * This operator should be called whenever we're starting a new pipeline, from the existing pipeline (the source pipeline would usually end with a 'share' operator).
 * By using fork, we're starting a new pipeline, but keeping reference to the source pipeline in the forked pipeline and vice versa.
 * @example
 * ```ts
 * const connector = new ReplaySubject(1) // Replay subject used as a multicast connector for the source pipeline
 * const sourcePipeline = origin.pipe(
 * 	start("pipeline-1"),
 * 	...someOperators,
 * 	share({ connector })
 * )
 *
 * const forkedPipeline1 = connector.pipe(
 * 	fork("forked-pipeline-1"),
 * 	...someOperators1
 * )
 *
 * const forkedPipeline2 = connector.pipe(
 * 	fork("forked-pipeline-2"),
 * 	...someOperators2
 * )
 * ```
 * @param forkId pipeline id for the forked pipeline
 * @returns
 */
export const fork = logger.fork;

/**
 * Log should be called with each operator in the pipeline to instrument the pipeline for logging.
 * @example
 * ```ts
 * // Regular RxJS pipeline would look something like this
 * const pipeline = observable.pipe( // Observable omitting a number value
 * 	map(value => value + 2), // still Transmitting a number value
 * 	map(value => value.toString()) // Transmitting a string value further
 * )
 *
 * // Same pipeline, only instrumented for logging
 * const loggedObservable = observable.pipe(start("pipeline-1")) // Instrument the observable first
 * const loggedPipeline = loggedObservable.pipe( // The observable is now passing a value (string in this case) with meta {pipelineId, streamId, value}
 * 	log("add_2", map(value => value + 2)), // The operator argument (map) is passed only the 'value' part of the value with meta, but the 'log' operator receives and transmits the value with meta
 * 	log("convert_to_string", map(value => value.toString())) // This operator receives a value (number) with meta, performs applies a 'map' operator and transmits a value (string) with meta
 * )
 * ```
 */
export const log = logger.log;
/**
 * Register the rxjs logger instance to the window object to make it accessible from
 * the console.
 * This should be ran only once, when the app is initialised.
 *
 * Note: This will cause errors if ran in any environment outside the browser, where the window object
 * is not defined
 */
export const registerClient = logger.registerClient;

export * from "./types";
export * from "./operators";

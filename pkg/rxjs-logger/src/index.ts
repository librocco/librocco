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
 * This operator should be called whenever we're starting a new pipeline from the existing pipeline (the source pipeline would usually end with a 'share' operator).
 * By using fork, we're starting a new pipeline, but keeping reference to the source pipeline in the forked pipeline and vice versa
 * (actually we're keeping reference to source transmissions and forked transmissions, but the pipeline can use its transmissions to calculate
 * all of the sources and forks for the entire pipeline).
 *
 * _Note: When a transmission passes through a fork, a new transmission is created (in the forked pipeline), but the new transmission keeps track of its source transmission
 * and has the same id.
 *
 * @example
 * ```ts
 * const connector = new ReplaySubject(1) // Replay subject used as a multicast connector for the source pipeline
 * const sourcePipeline = origin.pipe(
 * 	start("pipeline-1"),
 * 	...someOperators,
 * 	share({ connector: () => connector })
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
 * This operator should be called when, instead of forking a single transmission, we're starting a new pipeline by combining multiple pipelines (e.g. through 'combineLatest').
 * This way, the newly created pipeline is added to all of source pipelines' forks and the source pipelines are added as sources to the newly created pipeline.
 * (actually we're keeping reference to source transmissions and forked transmissions, but the pipeline can use its transmissions to calculate
 * all of the sources and forks for the entire pipeline).
 *
 * _Note: The transmission started by joining the pipelines keeps track of all of the source transmissions influencing the currently transmitted value
 * and has the same id as the latest transmission to arrive to the join operator.
 *
 * @example
 * ```ts
 * const origin1 = origin.pipe(start("pipeline-1")
 * const origin2 = origin.pipe(start("pipeline-2")
 *
 * const joinedPipeline = combineLatest([origin1, origin2]).pipe(
 *     join("joined-pipeline"),
 *    ...someOperators
 * )
 * ```
 * @param newPipelineId pipeline id for the pipeline created at join
 * @returns
 */
export const join = logger.join;

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
 * LogOnce behaves the same way as log, only it logs only the first transmission to pass through the operator.
 *
 * _Note: This isn't used very often and is mostly used with combination with 'switchMap' when we're not logging the updates from the
 * result stream, but rather keeping track of the pipeline initiating the new stream using 'switchMap'._
 */
export const logOnce = logger.logOnce;

/**
 * Register the rxjs logger instance to the window object to make it accessible from
 * the console.
 * This should be ran only once, when the app is initialised.
 *
 * _Note: This will cause errors if ran in any environment outside the browser, where the window object
 * is not defined_
 */
export const registerClient = logger.registerClient;

export * from "./types";
export * from "./operators";

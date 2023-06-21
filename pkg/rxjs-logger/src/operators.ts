import { map, OperatorFunction } from "rxjs";

import { ValueWithMeta, LogsMeta } from "./types";

/**
 * A util operator used to wrap the value transmitted through the pipeline
 * with the logs meta.
 * Not to be confused with 'start' operator - wrapping the initial value transmitted through the pipeline
 *
 * This is useful when continuing an existing pipeline, only we're changing the observable (e.g. through switch map)
 * and we want to wrap the value transmitted from the switched observable, keeping the value with meta structure transmitted
 * further down the pipeline.
 * @param meta
 * @returns
 */
export const wrap = <V>(getMeta: () => LogsMeta): OperatorFunction<V, ValueWithMeta<V>> => map((value) => ({ ...getMeta(), value }));

/**
 * This method merely unwraps the 'value' field from the value with meta structure and should be used at the very end of the pipeline.
 * @returns
 */
export const unwrap = <V>(): OperatorFunction<ValueWithMeta<V>, V> => map(({ value }) => value);

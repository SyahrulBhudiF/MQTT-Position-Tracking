import { type Context, Effect, Layer, ManagedRuntime, Runtime } from 'effect';

/**
 * Base application layer - can be extended with services
 */
export type AppLayer = Layer.Layer<never, never, never>;

/**
 * Create a managed runtime from a layer
 */
export const createManagedRuntime = <R, E>(
  layer: Layer.Layer<R, E, never>,
): Effect.Effect<ManagedRuntime.ManagedRuntime<R, E>, E, never> => {
  return Effect.sync(() => ManagedRuntime.make(layer));
};

/**
 * Run an Effect and return a Promise
 * This is the primary way to bridge Effect with NestJS async/await
 */
export const runEffect = <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> => {
  return Effect.runPromise(effect);
};

/**
 * Run an Effect that may fail and return a Promise with Either-like result
 */
export const runEffectExit = <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> => {
  return Effect.runPromise(effect.pipe(Effect.catchAll((error) => Effect.die(error))));
};

/**
 * Run an Effect with a specific runtime
 */
export const runWithRuntime = <R, A, E>(
  runtime: Runtime.Runtime<R>,
  effect: Effect.Effect<A, E, R>,
): Promise<A> => {
  return Runtime.runPromise(runtime)(effect);
};

/**
 * Create a Layer from a NestJS service using Context.Tag
 */
export const serviceLayer = <I, S>(
  tag: Context.Tag<I, S>,
  implementation: S,
): Layer.Layer<I, never, never> => {
  return Layer.succeed(tag, implementation);
};

/**
 * Utility to convert a Promise to an Effect
 */
export const fromPromise = <A>(promise: () => Promise<A>): Effect.Effect<A, Error, never> => {
  return Effect.tryPromise({
    try: promise,
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });
};

/**
 * Utility to convert a Promise with known error type to an Effect
 */
export const fromPromiseWithError = <A, E>(
  promise: () => Promise<A>,
  mapError: (error: unknown) => E,
): Effect.Effect<A, E, never> => {
  return Effect.tryPromise({
    try: promise,
    catch: mapError,
  });
};

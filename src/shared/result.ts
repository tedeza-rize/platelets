export type GoResult<T, E> =
  | readonly [value: T, error: null]
  | readonly [value: null, error: E];

export function ok<T>(value: T): readonly [value: T, error: null] {
  return [value, null];
}

export function fail<E>(error: E): readonly [value: null, error: E] {
  return [null, error];
}

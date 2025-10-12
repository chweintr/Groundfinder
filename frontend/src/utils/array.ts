export type Comparator<T> = (a: T, b: T) => number;

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

export function unique<T>(array: T[], identityFn: (element: T) => string | number): T[] {
  const seen = new Set<string | number>();
  return array.filter((element) => {
    const id = identityFn(element);
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}


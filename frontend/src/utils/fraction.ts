export type Fraction = [part: number, whole: number];

export function toRatio([part, whole]: Fraction): [number, number] {
  return [part, whole - part];
}


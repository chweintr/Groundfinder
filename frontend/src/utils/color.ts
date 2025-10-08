export interface LabColor {
  L: number;
  a: number;
  b: number;
}

export interface LchColor {
  L: number;
  C: number;
  H: number;
}

export function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbChannelToLinear(r);
  const gl = srgbChannelToLinear(g);
  const bl = srgbChannelToLinear(b);

  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  const z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;
  return [x, y, z];
}

export function xyzToLab(x: number, y: number, z: number): LabColor {
  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;

  const epsilon = 0.008856;
  const kappa = 903.3;

  const fx = f(x / Xn);
  const fy = f(y / Yn);
  const fz = f(z / Zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };

  function f(t: number): number {
    return t > epsilon ? Math.cbrt(t) : (kappa * t + 16) / 116;
  }
}

export function labToLch({ L, a, b }: LabColor): LchColor {
  const C = Math.sqrt(a * a + b * b);
  const H = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C, H };
}

export function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

export function relativeValue(L: number): number {
  return Math.max(0, Math.min(100, L));
}


declare module "culori" {
  type Color = Record<string, number | string | undefined>;

  export function parse(color: string): Color | undefined;
  export function formatRgb(color: Color): string;
}

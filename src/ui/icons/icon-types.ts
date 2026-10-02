import type { SVGProps } from "react";

export type IconSize = number | string;

export type IconProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  /** Sets both rendered dimensions. Numbers are interpreted as CSS pixels. */
  size?: IconSize;
  /** Gives a standalone icon an accessible name. Omit inside a labelled control. */
  title?: string;
};

import * as React from "react";

/**
 * A type alias for svgr loaded SVG as React component
 */
export type SVGComponent = React.FunctionComponent<
  React.SVGProps<SVGSVGElement> & { title?: string }
>;

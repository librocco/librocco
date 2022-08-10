import React from "react";
import { ComponentMeta } from "@storybook/react";

import SVGTest from "./SVGTest";

export default {
  title: "SVG Test",
  component: SVGTest,
} as ComponentMeta<typeof SVGTest>;

export const Default = (): JSX.Element => <SVGTest />;

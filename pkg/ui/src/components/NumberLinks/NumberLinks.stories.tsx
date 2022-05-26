import React from "react";
import { ComponentMeta } from "@storybook/react";

import NumberLinks from "./NumberLinks";

export default {
  title: "NumberLinks",
  component: NumberLinks,
} as ComponentMeta<typeof NumberLinks>;

const dummyLinks = Array(12)
  .fill(null)
  .map((_, i) => `link-${i + 1}`);

export const Default = (): JSX.Element => <NumberLinks links={dummyLinks} />;

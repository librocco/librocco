import React from "react";
import { ComponentMeta } from "@storybook/react";

import NumberLinks from "./NumberLinks";

export default {
  title: "NumberLinks",
  component: NumberLinks,
} as ComponentMeta<typeof NumberLinks>;

export const Default = (): JSX.Element => <NumberLinks links={[]} />;

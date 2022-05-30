import React from "react";
import { ComponentMeta } from "@storybook/react";

import Button from "./Button";

export default {
  component: Button,
  title: "Button",
} as ComponentMeta<typeof Button>;

export const Default = (): JSX.Element => <Button>Click me</Button>;

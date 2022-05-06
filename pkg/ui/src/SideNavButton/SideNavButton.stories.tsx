import React from "react";
import { ComponentMeta } from "@storybook/react";

import SideNavButton from "./SideNavButton";

import TestIcon from "@/assets/TestIcon.svg";

export default {
  title: "Side Navigation: Button",
  component: SideNavButton,
} as ComponentMeta<typeof SideNavButton>;

export const Variants = (): JSX.Element => (
  <div>
    <h1 className="text-md bold block mb-2">Inactive:</h1>
    <SideNavButton className="block mb-4">
      <TestIcon />
    </SideNavButton>
    <h1 className="text-md bold block mb-2">Selected:</h1>
    <SideNavButton selected>
      <TestIcon />
    </SideNavButton>
  </div>
);

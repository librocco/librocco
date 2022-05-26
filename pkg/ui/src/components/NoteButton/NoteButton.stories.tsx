import React from "react";
import { ComponentMeta } from "@storybook/react";

import { StorybookGrid, StorybookItem } from "../../utils/storybook";

import NoteButton, { NoteButtonType, NoteButtonLabel } from "./NoteButton";

export default {
  component: NoteButton,
  title: "NoteButton",
} as ComponentMeta<typeof NoteButton>;

export const Default = (): JSX.Element => (
  <>
    <h1 className="text-lg font-bold mb-4">Note In:</h1>
    <StorybookGrid className="mb-16">
      <StorybookItem>
        <NoteButton type={NoteButtonType.In}></NoteButton>
      </StorybookItem>
    </StorybookGrid>
    <h1 className="text-lg font-bold mb-4">Note Out:</h1>
    <StorybookGrid className="mb-16">
      <StorybookItem>
        <NoteButton type={NoteButtonType.Out}></NoteButton>
      </StorybookItem>
    </StorybookGrid>
    <h1 className="text-lg font-bold mb-4">Global Out:</h1>
    <StorybookGrid>
      <StorybookItem>
        <NoteButton
          type={NoteButtonType.Out}
          label={NoteButtonLabel.RemoveBooks}
        />
      </StorybookItem>
    </StorybookGrid>
  </>
);

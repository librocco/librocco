import React from "react";
import { ComponentMeta } from "@storybook/react";

import NoteButton, {
  NoteButtonType,
  NoteButtonLabel,
  NoteButtonShape,
} from "./NoteButton";

export default {
  component: NoteButton,
  title: "NoteButton",
} as ComponentMeta<typeof NoteButton>;

export const Default = (): JSX.Element => (
  <>
    <h1 className="text-lg font-bold mb-4 mt-4">Note In:</h1>

    <NoteButton
      shape={NoteButtonShape.RoundedRight}
      type={NoteButtonType.In}
    ></NoteButton>

    <h1 className="text-lg font-bold mb-4 mt-4">Note Out:</h1>

    <NoteButton
      shape={NoteButtonShape.RoundedRight}
      type={NoteButtonType.Out}
    ></NoteButton>

    <h1 className="text-lg font-bold mb-4 mt-4">Global Out:</h1>

    <NoteButton type={NoteButtonType.Out} label={NoteButtonLabel.RemoveBooks} />
  </>
);

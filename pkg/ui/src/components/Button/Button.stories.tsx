import React from "react";
import { ComponentMeta } from "@storybook/react";

import Button, {
  ButtonColor,
  ButtonShape,
  ButtonSize,
  ButtonVariant,
} from "./Button";

import TestIcon from "@/assets/TestIcon.svg";

import { StorybookGrid, StorybookItem } from "@/utils/storybook";

export default {
  title: "Button",
  component: Button,
} as ComponentMeta<typeof Button>;

const buttonText = "Click me";

export const Variants = (): JSX.Element => (
  <>
    <h1 className="text-lg font-bold mb-4">Text:</h1>
    <StorybookGrid className="mb-16">
      {Object.values(ButtonSize).map((size) => (
        <StorybookItem label={`Size: ${size}`}>
          <Button {...{ size }}>{buttonText}</Button>
        </StorybookItem>
      ))}
    </StorybookGrid>
    <h1 className="text-lg font-bold mb-4">Circular:</h1>
    <StorybookGrid>
      {Object.values(ButtonSize).map((size) => (
        <StorybookItem label={`Size: ${size}`}>
          <Button variant={ButtonVariant.Circular} {...{ size }} />
        </StorybookItem>
      ))}
    </StorybookGrid>
  </>
);

export const Shapes = (): JSX.Element => (
  <>
    <h1 className="text-lg font-bold mb-4">Square:</h1>
    <StorybookGrid className="mb-16">
      {Object.values(ButtonSize).map((size) => (
        <StorybookItem label={`Size: ${size}`}>
          <Button {...{ size }}>{buttonText}</Button>
        </StorybookItem>
      ))}
    </StorybookGrid>
    <h1 className="text-lg font-bold mb-4">Round:</h1>
    <StorybookGrid>
      {Object.values(ButtonSize).map((size) => (
        <StorybookItem label={`Size: ${size}`}>
          <Button shape={ButtonShape.Rounded} {...{ size }}>
            {buttonText}
          </Button>
        </StorybookItem>
      ))}
    </StorybookGrid>
  </>
);

export const Icons = (): JSX.Element => (
  <>
    <h1 className="text-lg font-bold mb-4">Start:</h1>
    <Button className="mb-16" StartIcon={TestIcon}>
      {buttonText}
    </Button>
    <h1 className="text-lg font-bold mb-4">End:</h1>
    <Button className="mb-16" EndIcon={TestIcon}>
      {buttonText}
    </Button>
  </>
);

const ColorsStory = (): JSX.Element => (
  <>
    <h1 className="text-lg font-bold mb-4">Primary:</h1>
    <StorybookGrid className="mb-16">
      <StorybookItem>
        <Button>{buttonText}</Button>
      </StorybookItem>
      <StorybookItem>
        <Button shape={ButtonShape.Rounded}>{buttonText}</Button>
      </StorybookItem>
      <StorybookItem>
        <Button variant={ButtonVariant.Circular}>{buttonText}</Button>
      </StorybookItem>
    </StorybookGrid>
    <h1 className="text-lg font-bold mb-4">Secondary:</h1>
    <StorybookGrid className="mb-16">
      <StorybookItem>
        <Button color={ButtonColor.Secondary}>{buttonText}</Button>
      </StorybookItem>
      <StorybookItem>
        <Button color={ButtonColor.Secondary} shape={ButtonShape.Rounded}>
          {buttonText}
        </Button>
      </StorybookItem>
      <StorybookItem>
        <Button color={ButtonColor.Secondary} variant={ButtonVariant.Circular}>
          {buttonText}
        </Button>
      </StorybookItem>
    </StorybookGrid>
    <h1 className="text-lg font-bold mb-4">White:</h1>
    <StorybookGrid className="mb-16">
      <StorybookItem>
        <Button color={ButtonColor.White}>{buttonText}</Button>
      </StorybookItem>
      <StorybookItem>
        <Button color={ButtonColor.White} shape={ButtonShape.Rounded}>
          {buttonText}
        </Button>
      </StorybookItem>
      <StorybookItem>
        <Button color={ButtonColor.White} variant={ButtonVariant.Circular}>
          {buttonText}
        </Button>
      </StorybookItem>
    </StorybookGrid>
  </>
);

export const ColorsNormal = () => <ColorsStory />;

export const ColorsHover = () => <ColorsStory />;
ColorsHover.parameters = { pseudo: { hover: true } };

export const ColorsFocus = () => <ColorsStory />;
ColorsFocus.parameters = { pseudo: { focus: true } };

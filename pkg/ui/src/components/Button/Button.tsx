import React from "react";

export enum ButtonVariant {
  Text = "text",
  Circular = "circular",
}

export enum ButtonShape {
  Square = "square",
  Rounded = "rounded",
}

export enum ButtonColor {
  Primary = "primary",
  White = "white",
  Secondary = "secondary",
}

export enum ButtonSize {
  XS = "xs",
  SM = "sm",
  Base = "md",
  LG = "lg",
  XL = "xl",
}

export interface ButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  color?: ButtonColor;
  /** @TODO This should be `SVGComponent` type alias */
  StartIcon?: React.FC;
  /** @TODO This should be `SVGComponent` type alias */
  EndIcon?: React.FC;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * A `React.FC` returning `null` used as icon fallback
 */
const IconFallback: React.FC = () => null;

const Button: React.FC<ButtonProps> = ({
  variant = ButtonVariant.Text,
  size = ButtonSize.Base,
  shape = ButtonShape.Square,
  color = ButtonColor.Primary,
  StartIcon = IconFallback,
  EndIcon = IconFallback,
  as = "button",
  className: classes = "",
  children,
  ...props
}) => {
  const className = [
    "px-3 py-2 bg-[rgba(0,0,255,0.3)] rounded flex items-center",
    classes,
  ].join(" ");

  return React.createElement(as, { ...props, className }, [
    <StartIcon />,
    children,
    <EndIcon />,
  ]);
};

export default Button;

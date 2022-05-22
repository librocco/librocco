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
  const sizeClasses = getSizeClasses(variant, shape, size);

  const shapeClass = getRadiusClass(variant, shape, size);

  const colorClasses = colorClassesLookup[color];

  const className = [...sizeClasses, shapeClass, ...colorClasses, classes].join(
    " "
  );

  return React.createElement(as, { ...props, className }, [
    <StartIcon />,
    children,
    <EndIcon />,
  ]);
};

const getRadiusClass = (
  variant: ButtonVariant,
  shape: ButtonShape,
  size: ButtonSize
) =>
  variant === ButtonVariant.Circular
    ? "rounded-full"
    : shapeClassLookup[shape][size];

const shapeClassLookup = {
  [ButtonShape.Square]: {
    [ButtonSize.XS]: "rounded-[15px]",
    [ButtonSize.SM]: "rounded-[17px]",
    [ButtonSize.Base]: "rounded-[19px]",
    [ButtonSize.LG]: "rounded-[21px]",
    [ButtonSize.XL]: "rounded-[25px]",
  },
  [ButtonShape.Rounded]: {
    [ButtonSize.XS]: "rounded",
    [ButtonSize.SM]: "rounded-md",
    [ButtonSize.Base]: "rounded-md",
    [ButtonSize.LG]: "rounded-md",
    [ButtonSize.XL]: "rounded-md",
  },
};

const getSizeClasses = (
  variant: ButtonVariant,
  shape: ButtonShape,
  size: ButtonSize
): string[] => {
  const textClasses = textSizeLookup[size];
  const spacingClasses =
    variant === ButtonVariant.Circular
      ? circularPaddingLookup[size]
      : shapeSpacingLookup[shape][size];

  return [...textClasses, ...spacingClasses, ...focusClasses];
};

const textSizeLookup = {
  [ButtonSize.XS]: ["text-xs", "leading-4"],
  [ButtonSize.SM]: ["text-sm", "leading-4"],
  [ButtonSize.Base]: ["text-sm", "leading-5"],
  [ButtonSize.LG]: ["text-base", "leading-6"],
  [ButtonSize.XL]: ["text-base", "leading-6"],
};

const circularPaddingLookup = {
  [ButtonSize.XS]: ["p-[10px]"],
  [ButtonSize.SM]: ["p-[12px]"],
  [ButtonSize.Base]: ["p-[14px]"],
  [ButtonSize.LG]: ["p-[15px]"],
  [ButtonSize.XL]: ["p-[19px]"],
};

const shapeSpacingLookup = {
  [ButtonShape.Square]: {
    [ButtonSize.XS]: ["px-[11px]", "py-[7px]"],
    [ButtonSize.SM]: ["px-[13px]", "py-[9px]"],
    [ButtonSize.Base]: ["px-[17px]", "py-[9px]"],
    [ButtonSize.LG]: ["px-[17px]", "py-[9px]"],
    [ButtonSize.XL]: ["px-[25px]", "py-[13px]"],
  },
  [ButtonShape.Rounded]: {
    [ButtonSize.XS]: ["px-[13px]", "py-[7px]"],
    [ButtonSize.SM]: ["px-[15px]", "py-[9px]"],
    [ButtonSize.Base]: ["px-[17px]", "py-[9px]"],
    [ButtonSize.LG]: ["px-[21px]", "py-[9px]"],
    [ButtonSize.XL]: ["px-[25px]", "py-[13px]"],
  },
};

const colorClassesLookup = {
  [ButtonColor.Primary]: ["text-white", "bg-indigo-600", "hover:bg-indigo-700"],
  [ButtonColor.Secondary]: [
    "text-indigo-700",
    "bg-indigo-100",
    "hover:bg-indigo-200",
  ],
  [ButtonColor.White]: [
    "text-gray-700",
    "bg-white",
    "border",
    "border-gray-300",
    "hover:bg-gray-50",
  ],
};

// Classes for focus pseudo-class are the same regardless of color prop
const focusClasses = [
  "focus:ring-2",
  "focus:ring-indigo-500",
  "focus:ring-offset-2",
  "focus:ring-offset-white",
];

export default Button;

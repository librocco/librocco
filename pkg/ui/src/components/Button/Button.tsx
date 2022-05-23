import React from "react";

import PlusIcon from "@/assets/Plus.svg";

// #region types
export enum ButtonShape {
  Square = "square",
  Rounded = "rounded",
  Circular = "circular",
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

export enum IconPosition {
  Start = "left",
  End = "right",
}

export interface ButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  shape?: ButtonShape;
  color?: ButtonColor;
  /** @TODO This should be `SVGComponent` type alias */
  Icon?: React.FC;
  iconPosition?: IconPosition;
  as?: keyof JSX.IntrinsicElements;
}
// #endregion types

// #region Component

// #region Component

const Button: React.FC<ButtonProps> = ({
  size = ButtonSize.Base,
  shape = ButtonShape.Square,
  color = ButtonColor.Primary,
  Icon,
  iconPosition = IconPosition.Start,
  as = "button",
  className: classes = "",
  children,
  ...props
}) => {
  const sizeClasses = getSizeClasses(shape, size);

  const shapeClass = getRadiusClass(shape, size);

  const colorClasses = colorClassesLookup[color];

  const className = [...sizeClasses, shapeClass, ...colorClasses, classes].join(
    " "
  );

  const content =
    shape === ButtonShape.Circular ? (
      <CircularContent {...{ children, size }} />
    ) : (
      <ButtonContent {...{ size, color, children, Icon, iconPosition }} />
    );

  return React.createElement(as, { ...props, className }, content);
};
// #endregion Component

// #region borderRadius
const getRadiusClass = (shape: ButtonShape, size: ButtonSize): string =>
  shape === ButtonShape.Circular
    ? "rounded-full"
    : shapeRadiusLookup[shape][size];

const shapeRadiusLookup = {
  [ButtonShape.Square]: {
    [ButtonSize.XS]: "rounded",
    [ButtonSize.SM]: "rounded-md",
    [ButtonSize.Base]: "rounded-md",
    [ButtonSize.LG]: "rounded-md",
    [ButtonSize.XL]: "rounded-md",
  },
  [ButtonShape.Rounded]: {
    [ButtonSize.XS]: "rounded-[15px]",
    [ButtonSize.SM]: "rounded-[17px]",
    [ButtonSize.Base]: "rounded-[19px]",
    [ButtonSize.LG]: "rounded-[21px]",
    [ButtonSize.XL]: "rounded-[25px]",
  },
};
// #endregion borderRadius

// #region size
const getSizeClasses = (shape: ButtonShape, size: ButtonSize): string[] => {
  const textClasses = textSizeLookup[size];
  const spacingClasses = shapeSpacingLookup[shape][size];

  return [...textClasses, ...spacingClasses, ...focusClasses];
};

const textSizeLookup = {
  [ButtonSize.XS]: ["text-xs", "leading-4"],
  [ButtonSize.SM]: ["text-sm", "leading-4"],
  [ButtonSize.Base]: ["text-sm", "leading-5"],
  [ButtonSize.LG]: ["text-base", "leading-6"],
  [ButtonSize.XL]: ["text-base", "leading-6"],
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
  [ButtonShape.Circular]: {
    [ButtonSize.XS]: ["p-[5px]"],
    [ButtonSize.SM]: ["p-[7px]"],
    [ButtonSize.Base]: ["p-[9px]"],
    [ButtonSize.LG]: ["p-[9px]"],
    [ButtonSize.XL]: ["p-[13px]"],
  },
};
// #endregion size

// #region color
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
// #endregion color

// #region buttonContent
/**
 * A component to be rendered as content in circular button.
 * This would normally be only the Icon SVG.
 * @param {Object} props
 * @param {JSX.Element | JSX.Element[]} props.children should be SVG Icon, if not provided falls back to `PlusIcon`
 * @param {ButtonSize} props.size
 */
const CircularContent: React.FC<Pick<ButtonProps, "children" | "size">> = ({
  children,
  size = ButtonSize.Base,
}) => (
  <div className={circularContentSizeLookup[size].join(" ")}>
    {children || <PlusIcon />}
  </div>
);

const circularContentSizeLookup = {
  [ButtonSize.XS]: ["w-4", "h-4"],
  [ButtonSize.SM]: ["w-4", "h-4"],
  [ButtonSize.Base]: ["w-4", "h-4"],
  [ButtonSize.LG]: ["w-5", "h-5"],
  [ButtonSize.XL]: ["w-5", "h-5"],
};

/**
 * A text part of the button with optional icon at the start or the end.
 * @param {Object} props
 * @param {JSX.Element | JSX.Element[]} props.children should be just the text
 * @param {ButtonSize} props.size
 * @param {SVGComponent} props.Icon
 * @param {IconPosition} props.iconPosition
 * @param {ButtonColor} props.color
 */
const ButtonContent: React.FC<
  Pick<ButtonProps, "children" | "Icon"> &
    Required<Pick<ButtonProps, "iconPosition" | "size" | "color">>
> = ({ children, size, Icon, iconPosition, color }) => {
  if (!Icon) {
    return <>{children}</>;
  }

  const iconSizeClasses = iconSizeLookup[size];
  const iconSpacingClasses = iconSpacingLookup[iconPosition][size];
  const iconColorClass = iconColorLookup[color];

  const WrapIcon: React.FC<Pick<ButtonProps, "children">> = ({ children }) => (
    <div
      className={[
        "relative",
        ...iconSizeClasses,
        ...iconSpacingClasses,
        iconColorClass,
      ].join(" ")}
    >
      {children}
    </div>
  );

  return (
    <span className="flex items-center">
      {iconPosition === IconPosition.Start && (
        <WrapIcon>
          <Icon />
        </WrapIcon>
      )}
      {children || null}
      {iconPosition === IconPosition.End && (
        <WrapIcon>
          <Icon />
        </WrapIcon>
      )}
    </span>
  );
};

const iconSizeLookup = {
  [ButtonSize.XS]: ["w-4", "h-4"],
  [ButtonSize.SM]: ["w-4", "h-4"],
  [ButtonSize.Base]: ["w-5", "h-5"],
  [ButtonSize.LG]: ["w-5", "h-5"],
  [ButtonSize.XL]: ["w-5", "h-5"],
};

const iconSpacingLookup = {
  [IconPosition.Start]: {
    [ButtonSize.XS]: ["mr-[6px]", "-left-[2px]"],
    [ButtonSize.SM]: ["mr-[6px]", "-left-[2px]"],
    [ButtonSize.Base]: ["mr-[6px]", "-left-[2px]"],
    [ButtonSize.LG]: ["mr-[10px]", "-left-[2px]"],
    [ButtonSize.XL]: ["mr-[10px]", "-left-[2px]"],
  },
  [IconPosition.End]: {
    [ButtonSize.XS]: ["ml-[6px]", "left-[2px]"],
    [ButtonSize.SM]: ["ml-[6px]", "left-[2px]"],
    [ButtonSize.Base]: ["ml-[6px]", "left-[2px]"],
    [ButtonSize.LG]: ["ml-[10px]", "left-[2px]"],
    [ButtonSize.XL]: ["ml-[10px]", "left-[2px]"],
  },
};

const iconColorLookup = {
  [ButtonColor.Primary]: "text-white",
  [ButtonColor.Secondary]: "text-indigo-500",
  [ButtonColor.White]: "text-gray-500",
};
// #endregion buttonContent

export default Button;

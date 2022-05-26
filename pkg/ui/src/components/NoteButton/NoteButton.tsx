import React from "react";

import ArrowCircleLeft from "@assets/ArrowCircleLeft.svg";
import ArrowCircleRight from "@assets/ArrowCircleRight.svg";

// #region types
export interface NoteButtonProps
  extends React.HTMLAttributes<HTMLButtonElement> {
  type?: NoteButtonType;
  label?: NoteButtonLabel | Warehouse;
  onClick?: () => void;
}

export enum NoteButtonLabel {
  RemoveBooks = "Remove Books",
}

export enum NoteButtonType {
  In = "in",
  Out = "out",
}

export enum Warehouse {
  Scolastica = "scolastica",
  Nuovo = "nuovo",
  Varia = "varia",
}
// #endregion types

// #region color
const colorClassesLookup = {
  [NoteButtonType.In]: ["text-white", "bg-green-400", "hover:bg-green-500"],
  [NoteButtonType.Out]: ["text-white", "bg-red-400", "hover:bg-red-500"],
};

// Classes for focus pseudo-class are the same regardless of color prop
const focusClasses = [
  "focus:ring-2",
  "focus:ring-indigo-500",
  "focus:ring-offset-2",
  "focus:ring-offset-white",
];
// #endregion color

// #region Component
/**
 * A note button component implementing styles from the mockup.
 * In: green, warehouse label, two side sharp and two side square
 * Out: red, warehouse label, two side sharp and two side square
 * Global out: red, remove books label, square
 * @param {Object} props
 * @param {NoteButtonType} props.type
 * @param {NoteButtonLabel | Warehouse} props.label
 * @param {JSX.Element | JSX.Element[]} props.children
 */
const NoteButton: React.FC<NoteButtonProps> = ({
  children,
  type = NoteButtonType.In,
  label = Warehouse.Varia,
  onClick = () => {},
  ...props
}) => {
  const size = "md";
  const shape =
    label === NoteButtonLabel.RemoveBooks ? "rounded-md" : "rounded-r-md";
  const text = ["text-md", "leading-5"];
  const shapeSpacing = ["px-4.25", "py-2.25"];
  const color = colorClassesLookup[type];

  const className = [
    size,
    shape,
    ...text,
    ...shapeSpacing,
    ...color,
    ...focusClasses,
  ].join(" ");

  return (
    <span className="flex items-center">
      <button onClick={onClick} {...props} className={className}>
        <ButtonContent {...{ children, type, label }} />
      </button>
    </span>
  );
};

// #endregion Component

/**
 * A text part of the button with the icon
 * @param {Object} props
 * @param {NoteButtonType} props.type
 * @param {NoteButtonLabel} props.label
 */
const ButtonContent: React.FC<
  Required<Pick<NoteButtonProps, "type" | "label">>
> = ({ type, label }) => {
  const iconSizeClasses = ["w-6", "h-6"];
  const iconSpacingClasses = ["mr-1.5", "-left-0.5"];
  const iconColorClass = "text-white";

  const WrapIcon: React.FC<Pick<NoteButtonProps, "children">> = ({
    children,
  }) => (
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
      <WrapIcon>
        {type === NoteButtonType.In ? (
          <ArrowCircleRight />
        ) : (
          <ArrowCircleLeft />
        )}
      </WrapIcon>
      {label}
    </span>
  );
};

export default NoteButton;

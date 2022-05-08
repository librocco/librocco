import React, { HTMLAttributes } from "react";

interface SideNavButtonProps extends HTMLAttributes<HTMLButtonElement> {
  /**
   * A boolean flag used to switch styles for a selected button.
   */
  selected?: boolean;
  /**
   * A custom html tag we want to render the element as (defaults to "button")
   */
  as?: keyof JSX.IntrinsicElements;
}

const onClickFallback = (e: React.SyntheticEvent) => {
  e.preventDefault();
};

/**
 * A button used for side navigation as specified in the mockup
 */
const SideNavButton: React.FC<SideNavButtonProps> = ({
  children,
  className: classes,
  selected,
  as: htmlTag = "button", // 'as' used to be reserved for TS, better to be safe
  onClick = onClickFallback,
  ...props
}) => {
  const baseClasses = [
    "relative",
    "w-14",
    "h-14",
    "rounded-lg",
    "p-4",
    "cursor-pointer",
  ];

  // Colors dependant on the 'selected' state
  const bgColor = selected ? "bg-gray-900" : "bg-gray-700";
  const iconColor = selected ? "text-white" : "text-gray-400 hover:text-white";

  const className = [...baseClasses, bgColor, iconColor, classes]
    .join(" ")
    .trim()
    .replace(/%s%s/g, " ");

  // Icon box container with icon component passed as 'children'
  const iconBox = <div className="center-absolute w-4 h-4">{children}</div>;

  return React.createElement(htmlTag, { ...props, className, onClick }, [
    iconBox,
  ]);
};

export default SideNavButton;

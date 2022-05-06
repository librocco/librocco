import React, { HTMLAttributes } from "react";

interface SideNavButtonProps extends HTMLAttributes<HTMLButtonElement> {
  /**
   * A boolean flag used to switch styles for a selected button.
   */
  selected?: boolean;
  /**
   * A custom component used to render the `SideNavButton`. All the extra props (other than `Icon`, `selected` and `component`)
   * of `SideNavButton` are passed to that component on render.
   */
  component?: React.FC;
  /**
   * A custom html tag we want to render the element as (defaults to "button")
   */
  as?: keyof JSX.IntrinsicElements;
}

/**
 * The default component used to render the 'SideNavButton' if no custom
 * 'component' prop was passed.
 */
const DefaultComponent: React.FC<
  HTMLAttributes<HTMLButtonElement> & { as?: keyof JSX.IntrinsicElements }
> = ({ as = "button", children, ...props }) =>
  React.createElement(as, props, [children]);

/**
 * A button used for side navigation as specified in the mockup
 */
const SideNavButton: React.FC<SideNavButtonProps> = ({
  children,
  className: classes,
  selected,
  component,
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

  const Component = component || DefaultComponent;

  return (
    <Component {...{ ...props, className }}>
      <div className="center-absolute w-4 h-4">{children}</div>
    </Component>
  );
};

export default SideNavButton;

import React from "react";

import ChevronLeft from "@assets/ChevronLeft.svg";
import ChevronRight from "@assets/ChevronRight.svg";

import { getItemsToRender } from "./getItemsToRender";

export interface WrapperProps extends React.HTMLAttributes<HTMLElement> {
  to: string;
  disabled?: boolean;
}

type Wrapper<Props extends Record<string, unknown> = Record<string, unknown>> =
  React.FC<WrapperProps & Props>;

interface NumberLinksProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "onChange"> {
  /**
   * Maximum number of items to display, should be at least 5 and an odd number.
   * - if less then 5 is provided, will throw an error
   * - if even number provided, will fall back to preceeding odd number
   * Defaults to 7
   */
  maxItems?: number;
  /**
   * An array of link strings. This would normally be just a pathname without the domain.
   */
  links: string[];
  /**
   * An optional wrapper component to wrap each element (such as React router `Link` component).
   * Should accept the basic props (described below) as those are the props passed from inside of the PaginationNav component for each element.
   * @param {Object} props
   * @param {string} props.to pathname to link to (without the domain name)
   * @param {boolean} props.disabled
   */
  Wrapper?: Wrapper;
  /**
   * HTML tag used to render the element
   */
  as?: keyof JSX.IntrinsicElements;
  /**
   * On change function fired when the nav button is clicked.
   * @param {string} link pathname to reroute to
   * @param {number} i index (not the label) of the clicked nav: `label = 2 --> i = 1`
   */
  onChange?: (link: string, i: number) => void;
}

const FallbackWrapper: Wrapper = ({ children }) => <>{children}</>;

const NumberLinks: React.FC<NumberLinksProps> = ({
  links,
  maxItems = 7,
  onChange = () => {},
  Wrapper = FallbackWrapper,
}) => {
  const itemsToRender = getItemsToRender(links.length, maxItems, 0);

  const leftArrow = (
    <button className={getButtonClassName("inactive", "hover")}>
      <span className="block w-6 h-6">
        <ChevronLeft />
      </span>
    </button>
  );
  const rightArrow = (
    <button className={getButtonClassName("inactive", "hover")}>
      <span className="block w-6 h-6">
        <ChevronRight />
      </span>
    </button>
  );

  return (
    <div className="flex">
      {leftArrow}
      {itemsToRender.map((item, i) => {
        // Item being 'null' signals rendering of (unclickable) "..." button
        if (item === null) {
          return (
            <button
              className={getButtonClassName("inactive")}
              key={`elipsis-${i}`}
            >
              ...
            </button>
          );
        }

        // Links are 0-indexed and we want to display 1-indexed pages
        const label = item + 1;
        const link = links[item];

        return (
          <Wrapper key={link} to={link}>
            <button
              className={getButtonClassName(
                "hover",
                i === 0 ? "active" : "inactive"
              )}
              onClick={() => onChange(link, i)}
            >
              {label}
            </button>
          </Wrapper>
        );
      })}
      {rightArrow}
    </div>
  );
};

type ButtonClassVariant = "inactive" | "active" | "hover";

const getButtonClassName = (...variants: ButtonClassVariant[]): string =>
  variants.reduce(
    (acc, curr) => [acc, ...buttonVariantsLookup[curr]].join(" "),
    buttonBaseClasses.join(" ")
  );

const buttonBaseClasses = [
  "w-10",
  "h-[38px]",
  "flex",
  "items-center",
  "justify-center",
  "text-sm",
  "leading-5",
  "font-medium",
  "border",
];

const buttonVariantsLookup: Record<ButtonClassVariant, string[]> = {
  inactive: ["text-gray-500", "border-gray-300"],
  active: ["text-indigo-600", "bg-indigo-50", "border-indigo-500"],
  hover: ["hover:bg-indigo-50"],
};

export default NumberLinks;

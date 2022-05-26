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
   * Currently selected item index (0 - based)
   */
  currentItem: number;
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
   * Function fired when the nav button is clicked.
   * @param {string} link pathname to reroute to
   * @param {number} i index (not the label) of the clicked nav: `label = 2 --> i = 1`
   */
  onButtonClick?: (link: string, i: number) => void;
}

const FallbackWrapper: Wrapper = ({ children }) => <>{children}</>;

const NumberLinks: React.FC<NumberLinksProps> = ({
  maxItems = 7,
  links,
  currentItem,
  onButtonClick = () => {},
  Wrapper = FallbackWrapper,
}) => {
  const itemsToRender = getItemsToRender(links.length, maxItems, currentItem);

  // Don't render if there are no items to show
  // No need for pagination
  if (!itemsToRender.length) {
    return null;
  }

  // #region arrowButtons
  const [prevItem, nextItem] = [currentItem - 1, currentItem + 1];
  const [prevLink, nextLink] = [links[prevItem], links[nextItem]];

  const leftArrow = (
    <button
      disabled={!prevLink}
      onClick={() => onButtonClick(prevLink, prevItem)}
      className={getButtonClassName(
        "inactive",
        prevLink ? "hover" : "disabled"
      )}
    >
      <span className="block w-6 h-6">
        <ChevronLeft />
      </span>
    </button>
  );
  const rightArrow = (
    <button
      disabled={!nextLink}
      onClick={() => onButtonClick(nextLink, nextItem)}
      className={getButtonClassName(
        "inactive",
        nextLink ? "hover" : "disabled"
      )}
    >
      <span className="block w-6 h-6">
        <ChevronRight />
      </span>
    </button>
  );
  // #endregion arrowButtons

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

        const isActive = currentItem === i;

        return (
          <Wrapper key={link} to={link}>
            <button
              disabled={isActive}
              className={getButtonClassName(
                "hover",
                isActive ? "active" : "inactive"
              )}
              onClick={() => onButtonClick(link, i)}
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

// #region styles
type ButtonClassVariant = "inactive" | "active" | "hover" | "disabled";

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
  disabled: ["opacity-50"],
};
// #endregion styles

export default NumberLinks;

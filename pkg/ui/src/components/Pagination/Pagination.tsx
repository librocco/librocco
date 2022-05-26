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

interface PaginationProps
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
   * Should accept the basic props (described below) as those are the props passed from inside of the Pagination component for each element.
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

/**
 * A stateless component used to render the numbered navigation bar and display current active.
 * This is to be used for all sorts of pagination, most notably for search results.
 *
 * The component accepts `links` (an array of string links). The links are used to render numbered items (one for each link).
 * When a button is clicked, the `onButtonClick` function is fired with the corresponding link and (0 based) index of given link in
 * the `links` array (for stateful updates)
 *
 * The component being a stateless one, it accepts `currentItem` to visually mark the currently active link (and disable the button).
 * Stateful logic should be implemented outside of the component.
 * @param {Object} props
 * @param {number} props.maxItems maximum number of items to display, defaults to `7`, throws if `< 5`
 * @param {string[]} props.links an array of string links
 * @param {number} props.currentItem 0 based index of currently active item
 * @param {Function} props.onButtonClick on each button click, this function is called with the corresponding link and item position in `links` array
 * @param {React.FC} props.Wrapper an optional wrapper component to wrap each item (button) rendered and get `to` and `disabled` passed to it
 */
const Pagination: React.FC<PaginationProps> = ({
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

        // Links are 0 based and we want to display 1 based pages
        const label = item + 1;
        const link = links[item];

        const isActive = currentItem === item;

        return (
          <Wrapper key={link} to={link}>
            <button
              disabled={isActive}
              className={getButtonClassName(
                "hover",
                isActive ? "active" : "inactive"
              )}
              onClick={() => onButtonClick(link, item)}
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

export default Pagination;

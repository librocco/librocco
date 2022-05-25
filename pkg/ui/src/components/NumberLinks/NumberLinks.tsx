import React from "react";

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

const NumberLinks: React.FC<NumberLinksProps> = () => {
  return null;
};

export default NumberLinks;

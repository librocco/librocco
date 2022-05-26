import React, { useState } from "react";
import { ComponentMeta } from "@storybook/react";

import NumberLinks from "./NumberLinks";

import { StorybookGrid, StorybookItem } from "../../utils/storybook";

export default {
  title: "NumberLinks",
  component: NumberLinks,
} as ComponentMeta<typeof NumberLinks>;

const dummyLinks = Array(12)
  .fill(null)
  .map((_, i) => `link-${i + 1}`);

export const Interactive = (): JSX.Element => {
  const [currentItem, setCurrentItem] = useState(0);

  const onButtonClick = (_: string, i: number) => setCurrentItem(i);

  return (
    <div>
      <h1 className="mb-2 font-bold">Interactive</h1>
      <p className="mb-8 italic text-gray-500 w-sm">
        NumberLinks is a stateless component (current item is controlled from
        outside and passed as props). Only this story is interactive as it keeps
        state wrapped around the rendered component.
      </p>
      <h2>Current Item: {currentItem}</h2>
      <NumberLinks
        {...{ currentItem, onButtonClick, maxItems: 6 }}
        links={dummyLinks}
      />
    </div>
  );
};

export const MaxItems5 = (): JSX.Element => (
  <>
    <h1 className="mb-8 font-bold">Max Items: 5</h1>
    <StorybookGrid cols={3}>
      <StorybookItem className="mb-4" label="Current item near start">
        <NumberLinks maxItems={5} currentItem={2} links={dummyLinks} />
      </StorybookItem>
      <StorybookItem className="mb-4" label="Current item at center">
        <NumberLinks maxItems={5} currentItem={4} links={dummyLinks} />
      </StorybookItem>
      <StorybookItem className="mb-4" label="Current item near end">
        <NumberLinks maxItems={5} currentItem={9} links={dummyLinks} />
      </StorybookItem>
      <StorybookItem className="mb-4" label="First (Previous button disabled)">
        <NumberLinks maxItems={5} currentItem={0} links={dummyLinks} />
      </StorybookItem>
      <StorybookItem className="mb-4" label="Last (Next button disabled)">
        <NumberLinks maxItems={5} currentItem={11} links={dummyLinks} />
      </StorybookItem>
    </StorybookGrid>
  </>
);

export const MaxItems7 = (): JSX.Element => (
  <>
    <h1 className="mb-8 font-bold">Max Items: 7</h1>
    <StorybookGrid cols={2}>
      <StorybookItem className="mb-4" label="Current item near start">
        <NumberLinks maxItems={7} currentItem={2} links={dummyLinks} />
      </StorybookItem>
      <StorybookItem className="mb-4" label="Current item at center">
        <NumberLinks maxItems={7} currentItem={5} links={dummyLinks} />
      </StorybookItem>
      <StorybookItem className="mb-4" label="Current item near end">
        <NumberLinks maxItems={7} currentItem={9} links={dummyLinks} />
      </StorybookItem>
      <StorybookItem className="mb-4" label="First (Previous button disabled)">
        <NumberLinks maxItems={7} currentItem={0} links={dummyLinks} />
      </StorybookItem>
      <StorybookItem className="mb-4" label="Last (Next button disabled)">
        <NumberLinks maxItems={7} currentItem={11} links={dummyLinks} />
      </StorybookItem>
    </StorybookGrid>
  </>
);

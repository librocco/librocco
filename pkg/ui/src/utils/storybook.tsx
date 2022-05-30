import React, { ReactNode } from "react";

type FC<P extends Record<string, any> = Record<string, unknown>> = React.FC<
  P & { children: ReactNode[] | ReactNode; className?: string }
>;

export const StorybookGrid: FC = ({ children, className }) => (
  <div className={["w-lg h-24 grid grid-cols-5", className].join(" ")}>
    {children}
  </div>
);

export const StorybookItem: FC<{ label?: string }> = ({ children, label }) => (
  <figure className="w-full h-full flex flex-col items-stretch">
    <div className="w-full h-full flex justify-center items-center">
      {children}
    </div>
    {label && <figcaption className="w-full text-center">{label}</figcaption>}
  </figure>
);

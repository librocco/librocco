import React, { ReactNode } from "react";

type FC<P extends Record<string, any> = Record<string, unknown>> = React.FC<
  P & { children: ReactNode[] | ReactNode; className?: string }
>;

export const StorybookGrid: FC<{ cols?: number }> = ({
  children,
  className,
  cols: c = 5,
}) => {
  const cols = !c || c > 5 ? 1 : c;

  const colsClasses = [
    "",
    "grid-cols-1",
    "grid-cols-2",
    "grid-cols-3",
    "grid-cols-4",
    "grid-cols-5",
  ];

  return (
    <div
      className={["w-lg grid gap-y-12", colsClasses[cols], className].join(" ")}
    >
      {children}
    </div>
  );
};

export const StorybookItem: FC<{ label?: string }> = ({ children, label }) => (
  <figure className="w-full h-24 flex flex-col items-stretch">
    <div className="w-full h-full flex justify-center items-center">
      {children}
    </div>
    {label && (
      <figcaption className="w-full text-center text-gray-600">
        {label}
      </figcaption>
    )}
  </figure>
);

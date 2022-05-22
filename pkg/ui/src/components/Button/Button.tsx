import React from "react";

import Icon from "@/assets/TestIcon.svg";

interface ButtonProps {
  children: string;
  className?: string;
  onClick?: (e: React.SyntheticEvent) => void;
}

const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  onClick = () => {},
}) => {
  return (
    <button
      {...{ onClick }}
      className={[
        "px-3 py-2 bg-[rgba(0,0,255,0.3)] rounded flex items-center",
        className,
      ].join(" ")}
    >
      <div className="w-4 h-4 mr-2">
        <Icon />
      </div>
      {children}
    </button>
  );
};

export default Button;

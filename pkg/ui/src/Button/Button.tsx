import React from "react";

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
      className={["px-3 py-2 bg-[rgba(0,0,255,0.3)] rounded", className].join(
        " "
      )}
    >
      {children}
    </button>
  );
};

export default Button;

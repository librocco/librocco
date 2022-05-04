import React from "react";

const Button: React.FC<{ children: string; className?: string }> = ({
  children,
  className = "",
}) => {
  return (
    <button
      className={["px-3 py-2 bg-[rgba(0,0,255,0.3)] rounded", className].join(
        " "
      )}
    >
      {children}
    </button>
  );
};

export default Button;

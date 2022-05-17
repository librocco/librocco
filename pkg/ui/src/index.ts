import Button from "./Button";
import SideNavButton from "./SideNavButton";
import SVGTest from "./SVGTest";

// Main CSS is imported here to signal the bundler the usage of Tailwind
// in order to generate a PostCSS built css file next to the bundle
import "./main.css";

export { Button, SideNavButton, SVGTest };

export * from "./Button";
export * from "./SideNavButton";

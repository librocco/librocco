import React from "react";
import { createRoot } from "react-dom/client";

// Import main.css in order to generate tailwind classes used in the app
import "./main.css";
// Import ui .css file to make sure all of the tailwind classes, used in 'ui' package are available
// in the final app (and not purged if the app src files don't use them)
import "@librocco/ui/dist/style.css";

import App from "./App";

const container = document.getElementById("root");
const root = createRoot(container as HTMLElement);
root.render(<App />);

import React from "react";

import { Button } from "ui";

const App: React.FC = () => (
  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
    <h1 className="text-[2.5rem]">Hello World</h1>
    <p className="text-xl text-center text-[rgba(0,0,0,0.5)]">
      I'm your client web app
    </p>
    <Button className="relative left-1/2 -translate-x-1/2 mt-2">
      Click me
    </Button>
  </div>
);

export default App;

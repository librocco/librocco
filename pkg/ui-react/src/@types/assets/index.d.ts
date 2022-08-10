declare module "*.svg" {
  import { SVGComponent } from "@librocco/shared";

  const Component: SVGComponent;

  export default Component;
}

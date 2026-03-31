import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://codemyriad.io",
  integrations: [
    starlight({
      title: "",
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: true,
      },
      components: {
        Head: "./src/components/Head.astro",
      },
      social: {
        github: "https://github.com/codemyriad/librocco",
      },
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "getting-started/introduction" },
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quick Start", slug: "getting-started/quick-start" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Development", slug: "guides/development" },
            { label: "Sync Server", slug: "guides/sync-server" },
            { label: "Book Data Plugins", slug: "guides/book-data-plugins" },
          ],
        },
        {
          label: "Architecture",
          items: [
            { label: "Overview", slug: "architecture/overview" },
            { label: "Offline-First Design", slug: "architecture/offline-first" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "CLI Reference", slug: "reference/cli" },
            { label: "Environment Variables", slug: "reference/environment-variables" },
          ],
        },
      ],
      customCss: ["./src/tailwind.css"],
      head: [
        {
          tag: "script",
          attrs: { src: "/sidebar-animation.js", defer: true },
        },
      ],
    }),
    mdx(),
    sitemap(),
    tailwind({ applyBaseStyles: false }),
  ],
  vite: {
    ssr: {
      noExternal: ["@fontsource/jetbrains-mono"],
    },
  },
});

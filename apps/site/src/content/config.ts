import { defineCollection, z } from "astro:content";
import { docsSchema } from "@astrojs/starlight/schema";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    draft: z.boolean().optional(),
  }),
});

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    draft: z.boolean().optional(),
    demoURL: z.string().optional(),
    repoURL: z.string().optional(),
  }),
});

const services = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    draft: z.boolean().optional(),
    href: z.string().optional(),
  }),
});

const docs = defineCollection({ schema: docsSchema() });

const changelog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    draft: z.boolean().optional(),
  }),
});

export const collections = { blog, projects, services, docs, changelog };

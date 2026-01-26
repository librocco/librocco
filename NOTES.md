# Notes on agentic setup for UI work

## Task

Pulling Figma styles from Figma Make and applying design changes to the app, in particular to **supplier/publisher management view**.

The task was attempted with agentic setup:
- OpenCode
- custom skill: dev-server -- for dev server usage
- custom skill: figma-make-compare -- instructing how to perform the design comparison
- MCP: playwright -- for browser usage
- models:
  - OS: Kimi-K2-Thinking
  - OS: GLM-4.7
  - Claude Sonnet 4.5

## Challenges

The (obvious) challenges are the amount of DOM code (HTML + design tokens -- CSS classes) and the fact that LLMs excel at natural language, whereas visual style poses a challenge in understanding and attention to detail.

Additional challenge is the fact that Figma Make link was treated as view-only, with no access to neither Figma style (Make-only, no design spec) nor Figma-Make-generated code.

## Skills

I wanted the agent to use the dev server in a particular way and didn't want to have to explicitly state it every time.
This seemed like a great use-case for a skill as it provided a clear and detailed instructions, but, being a skill, doesn't pollute the context when not needed (only used in some cases).

_see .opencode/skills/dev-server/SKILL.md._

Another thing I've written down as a skill are the instructions on how to pull design from Figma Make and compare it to existing implementation.
To be frank I'm still torn about as to whether I should use it as a skill or write a particular agent/subagent for the task

_see .opencode/skills/figma-make-compare/SKILL.md._

## Progress

The progress is tracked in prompts: `PROMPT_(1|2|3).md` with agent's proposals in `PROPOSAL(1|2).md` and `TASK.md` following the task throughout.

The task is kinda done, but not really:
- [*] split the views (orders/publisher config)
- [*] merge columns (old vs new publisher selection tables)
- [ ] design implementation - bad

## Notes

Agents are instructed (via skills) on how to use dev-server and figma-make for comparison. They listen sometimes, sometimes they don't.

Claude was used to implement the styles (final polish) and it performed only marginally better that OS models.

It had come to my attention that the chosen OS models don't even see the visuals (can't process images), however, looking at the trace, Claude may not have ingested the image either.

I was surprised to find that, even though instructed to look only at the preview app in Figma Make (rhs), the agent also read the Figma Make chat (lhs) and actually made use of the context discussed there: **this is a point for Figma MCP access** - potential unexpected, but useful context.

## Future refinement

Refine the comparison (potentially split into multiple skills, or explicitly define the step-by-step process) and use a visual model.
Potentially use a visual model in a subagent (so as to not pollute the scope).

Try the same task with access to Figma generated code (React components).

Try the same task with full Figma MCP access.

Try the same task with component split + Storybook (as initially instructed in the ticket).



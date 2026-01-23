Please read @TASK.md to get the context of the work we're doing.

The functionality is there, but the design is off. Please use Playwright MCP to compare the current implementation with Fiama Make app.
When snapshoting Figma Make app, make a point to click through to the supplier management page. You can use the updated e2e test as a guide for click-through.

As you understand the visual differences, plase iterate over the code to apply the exact styling:
1. Snapshot the Figma Make generated app
2. Snapshot the dev server
3. Implement changes (design) - you can use Figma app's DOM (design tokens) to better apply this
4. Snapshot the dev server again and verify if the updated styles match the requirements (if not, back to 3.)
5. Done!

IMPORTANT NOTE: don't pull the styles (from Figma Make) immediately, you're only allowed to pull style tokens in step 3. and not before.
IMPORTANT NOTE: rely on visual snapshots to validate the styles applied



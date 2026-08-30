# ADR 0003: Use a shared placeholder for planned features

- Status: draft
- Date: 2026-08-30
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- A product surface intentionally exposes a planned capability that is not implemented in the current release.
- A feature needs to communicate its future intent and offer a community-prioritization path.
- Building temporary UI for a capability whose backend, data contract, or workflow is not yet available.
- Not applicable when the capability is implemented and usable, or when it should be hidden until implementation begins.

## Context

- Exposing planned capabilities can help users understand the product direction and express demand without implying that the capability works today.
- One-off placeholder implementations create inconsistent language, visual behavior, accessibility, and community links.
- Portfolio Journal initially exposes planned Rules adherence and New experiments capabilities, while only its implemented actions may invoke application services.
- The Portfolio Engineering subreddit is the primary community channel for users to voice interest in prioritizing planned work.

## Decision Statement

Use one reusable React "Not Yet Implemented" component for intentionally visible, unavailable product capabilities. The component must clearly state that the capability is planned, accept feature-specific copy and links, and provide a visible community-prioritization call to action to the [Portfolio Engineering subreddit](https://www.reddit.com/r/PortfolioEngineering/).

The placeholder is presentation-only: it must not invoke feature APIs, AI services, data mutations, or simulated results. Features may provide additional optional links, such as the [GitHub issue tracker](https://github.com/pagalvin/portfolio-engineering/issues), without hardcoding feature-specific wording or destinations into the shared component.

## Do

- Reuse the shared React component whenever a planned capability is intentionally exposed.
- Supply a concise feature name and description that distinguish the planned behavior from currently available behavior.
- Include a clear unavailable/planned state that is understandable to keyboard and assistive-technology users.
- Pass community-prioritization links as component data; include the subreddit link by default for this product.
- Keep the component independent of feature-specific APIs, AI providers, persistence, and routing behavior.
- Test that the placeholder renders the supplied message and links and cannot invoke unavailable feature actions.
- Replace the placeholder with the implemented capability when its required user workflow, backend contract, and validation are available.

## Do Not

- Do not label a planned capability as active, generated, assessed, or complete.
- Do not trigger or stub backend, AI, persistence, or data-changing behavior from a placeholder.
- Do not create feature-specific placeholder components when the shared component supports the need.
- Do not hardcode journal-specific copy, Reddit destinations, or other feature policy into the shared component.
- Do not use the placeholder to conceal an implementation failure or temporarily unavailable production capability; surface those states as errors instead.

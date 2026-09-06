# Personal Investor Profile Feature Brief

- Status: draft
- Date: 2026-09-06
- Source: user brainstorming session on AI context and retail investor profiling

## Summary

Build a plain-English **Personal Investor Profile** feature that allows retail traders to capture key personal context, investment goals, options strategies, risk comfort, and behavioral tendencies.

This feature is **data-capture and management only**. It provides the UI, data schema, and persistence for an investor's profile within the app. It does not include prompt integration into AI journal analysis or automated rule enforcement in this initial slice.

## Business objective

Most retail options traders fail in their first year because they lack structure, trade out of restlessness, or enter trades without grounding them in a clear personal strategy.

To help retail traders succeed, future AI workflows (such as journal analysis) will need to evaluate trades against the investor's individual goals and approach. Capturing this profile establishes the durable user context required for high-quality, personalized AI coaching without forcing users to re-explain their strategy in every journal entry.

## Target user & tone

- **Target user**: Active retail investors and options traders primarily using income strategies (e.g., Covered Calls, Cash-Secured Puts, The Wheel, Buy & Hold). They are generally not finance professionals.
- **Tone**: Grounded, supportive, plain-English, and accessible.
- **Language policy**: Avoid hypey or "trader bro" jargon (e.g., *FOMO*, *revenge trading*, *bagholding*, *diamond hands*, *yield chasing*). Use clear, objective descriptions of behavior and strategy.

## Problem / opportunity

Generic financial questionnaires ask for numbers like net worth or abstract 1–10 risk ratings, which rarely reflect how retail options traders make decisions day-to-day.

Retail traders need a way to express:
- who they are and what they are trying to achieve;
- their specific strategy nuances (e.g., custom overlays or unique execution rules);
- how they handle assignment and downturns in plain terms;
- personal behavioral tendencies they want to be mindful of.

By collecting this structured context in a simple profile screen, P/OS creates a foundation for personalized AI observations in later feature slices.

## Desired user outcomes

- As a user, I can set up and edit my Personal Investor Profile in plain English.
- As a user, I can select standard options strategies (Covered Calls, Cash-Secured Puts, The Wheel, Buy & Hold) or specify a Custom/Hybrid strategy.
- As a user, I can write a detailed, free-form description of my custom strategy overlay (e.g., *"Deep ITM covered call with a buy/write/decide overlay"*).
- As a user, I can state my objectives, risk comfort, and position sizing preferences in everyday terms.
- As a user, I can select plain-English behavioral tendencies I want to watch out for.
- As a user, I can review my complete investor context in a single summary view.
- As a user, I know my profile is stored safely for my organization and can be updated as my experience grows.

## Initial scope

### 1. Identity & Experience
- **Preferred Name / Handle**: How the app addresses the user.
- **Experience Level**: Selections for *Beginner / Learning*, *Intermediate*, or *Experienced*.
- **Account / Portfolio Context**: High-level portfolio type (e.g., *Taxable account*, *Retirement / IRA*, *Limited capital account*).

### 2. Primary Investment Objective
- Clear goal selection / description:
  - Generating steady income on quality stocks I am happy to hold long-term.
  - Growing my portfolio steadily using options premium.
  - Learning options mechanics safely with controlled position sizes.
  - Capital growth / speculative income.

### 3. Strategies & Custom Description
- **Standard Strategy Presets** (Multi-select):
  - Covered Calls
  - Cash-Secured Puts
  - The Wheel Strategy
  - Buy & Hold Equities / ETFs
  - Custom / Hybrid Strategy
- **Custom Strategy & Overlay Description** (Free-text / Markdown area):
  - Allows users to describe specific setups, entry criteria, or overlays in their own words (e.g., *"I sell deep ITM covered calls on high-conviction value stocks for downside protection, using a buy/write/decide process at expiration"*).

### 4. Risk Comfort & Position Sizing (Everyday Terms)
- **Assignment Mindset**:
  - *Welcomes assignment on watch-list stocks.*
  - *Prefers rolling or managing options to avoid assignment when practical.*
- **Downturn Comfort**: Willingness and comfort level holding underlying shares through market declines.
- **Position Sizing Context**: Preferred allocation limits per ticker in high-level terms (e.g., max percentage of portfolio in a single position).

### 5. Behavioral Tendencies to Watch For
Plain-English selections for personal habits the trader wants to be mindful of:
- Selecting options primarily for high premium rather than company quality.
- Holding or rolling a losing position long after the original thesis has changed.
- Entering trades impulsively during sudden market swings.
- Trading out of restlessness or a desire to stay active rather than waiting for setup criteria.
- Changing strategy or exit criteria mid-trade without a pre-planned reason.

### 6. Summary View ("My Investor Profile")
- A clean, read-only card or dashboard view summarizing saved profile details.
- Markdown rendering for free-text strategy descriptions.

## Out of scope for this initial slice

- **AI Prompt Injection**: Feeding profile data into Journal Entry AI Analysis or other model calls (deferred to Phase 2).
- **Rules Engine / Enforcement**: Automated rule validation, hard blocking of trades, or alert engines (rules will be extracted into a separate dedicated feature).
- **Live Broker Integration**: Pulling live balances, positions, or trade executions from external broker APIs.
- **Financial Planning / Advice**: Automated calculation of tax strategies, specific stock recommendations, or individualized financial planning advice.

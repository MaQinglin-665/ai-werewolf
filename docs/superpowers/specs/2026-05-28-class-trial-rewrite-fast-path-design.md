# Class Trial Rewrite Fast Path Design

## Goal

Reduce visible class-trial GPT-SoVITS wait time by avoiding slow LLM rewrite calls for safe, high-frequency public speech lines.

## Scope

This is a local-only GPT-SoVITS performance slice. It does not change game rules, UI layout, character roster, voice weights, or GPT-SoVITS synthesis settings.

## Behavior

- Add a class-trial Japanese TTS rewrite result that carries both `textJa` and `mode`.
- `mode` is one of `cache`, `fast`, or `llm`.
- Check rewrite cache first, keyed by role id plus normalized Chinese source text.
- If no cache entry exists, try a conservative fast rewrite for short public狼人杀 phrases:
  - explanation requests with seat numbers.
  - vote declarations with seat numbers.
  - suspicion statements with seat numbers.
  - contradiction statements without adding new facts.
- If the fast rewrite does not match, call the existing LLM rewrite and validate it with the existing safeguards.
- Store both fast and LLM rewrites in the process cache.
- Add `rewriteMode` to the safe timing log payload.

## Safety

Fast rewrites must not invent identities, camps, death reasons, night results, vote targets, or claims. Complex lines fall back to LLM rewrite. Existing seat-number validation remains active for all outputs.

## Verification

- Focused rewrite helper tests cover fast match, cache reuse, LLM fallback, validation, and empty/explanatory output rejection.
- API route tests cover `rewriteMode` in timing logs.
- A live local route smoke should confirm `rewriteMode:"fast"` and near-zero `rewriteMs` for a known fast-path line.

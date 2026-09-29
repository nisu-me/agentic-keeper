# Integrations

Facts about third-party services: webhook behavior, retry semantics, sandbox quirks, rate limits. One section per service. Entry format: **the fact in bold**, context, anchor, date — all on ONE unwrapped line (rule 6 in [docs/README.md](../README.md)). Filed via `/capture`. The example below is fictional — replace with your first real integration fact.

## Acme Payments (example)

- **Acme webhooks retry 3× with 5-minute backoff, then dead-letter.** A handler that 500s three times loses the event silently — the dead-letter queue is only visible in their dashboard, no callback. `src/webhooks/acme.controller.ts`. *(2026-01)*

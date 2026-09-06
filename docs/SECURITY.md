# Local security model

The backend holds provider credentials and can make paid or quota-limited requests. A localhost bind alone does not stop a hostile website from attempting browser requests to it.

## Browser request controls

- Wildcard CORS is disabled.
- Requests carrying an `Origin` are accepted only from the exact same loopback origin or an entry in `STATBLOCK_ALLOWED_ORIGINS`.
- Allowed responses echo the exact permitted origin and include `Vary: Origin`.
- POST and DELETE routes require `X-Statblock-Client: statblock-parser`.
- Disallowed preflights and API calls return 403 without an allow-origin header.
- Originless requests remain available to CLI and local integration clients.

The custom header is not a secret. It forces cross-origin browser mutations through CORS preflight, where the origin policy is enforced.

## Credential scope

- UI-entered API keys stay in backend process memory.
- Custom-model credentials are indexed by the normalized exact base URL.
- A stored credential is never reused after changing to another host or path.
- `OPENAI_COMPATIBLE_API_KEY` is used only when the requested URL exactly matches `OPENAI_COMPATIBLE_API_BASE_URL`.
- Groq environment credentials are restricted to the exact configured Groq base URL.
- Provider secrets are never included in API responses.
- Ordinary provider failures are replaced with stable public messages. Raw upstream messages are retained only in local logs and explicit diagnostic artifacts.

## Deployment boundary

This is a single-user local application, not a multi-user authenticated service. `clientId` partitions parse jobs and reports but does not authenticate or authorize a person; changing it merely selects another routing namespace.

If the backend is exposed beyond loopback, place it behind real authentication, TLS, network access controls, and a deliberately configured origin allowlist.

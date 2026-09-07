# Bring Your Own AI

Bring Your Own AI (BYOA) lets you connect your own AI provider accounts to Portfolio OS. You supply the credentials, and Portfolio OS uses your connection to power AI-assisted features. Portfolio OS never provides its own shared AI account — you are always using your own provider relationship and your own usage costs.

This section has three parts:

- **Overview** — a quick summary of how many of your connections are working, disabled, or need attention.
- **Connections** — the list of AI provider accounts you have configured, with controls to add, edit, enable/disable, test, or remove a connection.
- **Providers** — the catalog of AI providers Portfolio OS currently supports, and providers planned for future support.

## How connections work

Each connection represents credentials for one AI provider account, such as an API key and any provider-specific settings it requires (for example, an endpoint URL or deployment name). Required fields vary by provider — Portfolio OS shows only the fields a given provider actually needs.

Your credentials are encrypted at rest and are never displayed back to you or included in exported data after you save them. Portfolio OS only decrypts a credential at the moment it is used to call your provider.

## Connection health

Each connection shows a health status:

- **Ready** — the connection has been used successfully or is newly added and untested.
- **Disabled** — you have turned the connection off. Disabled connections are not used even if otherwise valid.
- **Needs attention** — the most recent test or use of this connection failed. Check your credentials and provider account status.

## Testing a connection

Use **Test** on a connection to verify Portfolio OS can successfully reach your provider with the saved credentials, without waiting for a real feature to use it. Test results are rate-limited; if you test too frequently you may need to wait before testing again.

## Adding a connection

From **Providers**, choose a supported provider to start a new connection, or use **Connections** and add a new connection directly. You will be asked for the fields that specific provider requires. Save the connection, then use **Test** to confirm it works.

## Removing a connection

Deleting a connection permanently removes the stored credentials from Portfolio OS. This does not affect your account with the AI provider itself — you may still need to manage or revoke the key directly with your provider if you no longer want it to be usable elsewhere.

## Related help

See the Providers tab for the list of currently supported and planned AI providers.

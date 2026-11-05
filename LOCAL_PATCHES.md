# Local patches over upstream v0.12.0

The screenshot add-on source is synchronized to the upstream v0.12.0 release.
Its server-directed scheduling is unchanged. No account polling worker, account
credential option, custom scheduler health API or local prediction remains.

## Credential-safe execution logs

The local executor omits the credential-bearing webhook URL from successful and
failed completion summaries, reports only HTTP status, and redacts that URL from
transport error details before logging. Three tests capture actual LogTape output
for HTTP 200, HTTP 503 and an echoed transport error using synthetic credentials.
UI delivery responses and upload requests are unchanged.

This security fix is deliberately separate from the upstream scheduling design.
It is authorized for the fork only; a future upstream PR requires separate review.
Remove this patch after a released upstream fix is adopted and log-audited.

## Build metadata

Supervisor config selects this fork and omits the official `image` so it builds
patched source. The add-on/package version is `0.12.0-local.1`. Root bootstrap
files and this README notice are personal fork metadata, excluded from any later
security contribution. Household configuration and verification stay in the
private homeassistant repository, issue #298.

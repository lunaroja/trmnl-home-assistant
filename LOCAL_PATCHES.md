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

Supervisor config selects versioned fork images at
`ghcr.io/lunaroja/trmnl-ha-{arch}:0.12.0-local.2`. The existing Release workflow
builds both supported architectures from the `v0.12.0-local.2` release tag.
The source is the same patched v0.12.0 runtime as `0.12.0-local.1`; this release
changes packaging and version metadata only. Supervisor can pull the published
image during recovery instead of embedding a locally built image in every
backup. Publish and verify anonymous pulls for both architecture images before
updating a live installation. Keep version tags available for recovery.

Do not use the upstream image while its credential-log issue remains. Root
bootstrap files and these fork packaging notes are excluded from a later
security contribution. Household configuration and verification stay in the
private homeassistant repository, issues #298 and #333.

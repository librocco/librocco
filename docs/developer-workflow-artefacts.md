# Legacy Artefact Workflow (R2)

This document describes the legacy `3rd-party/artefacts` flow that is still present in the repository for compatibility.

The current supported dependency path for Librocco is registry-based:

- Install dependencies from `npm.codemyriad.io` by default.
- Use local source mode (`VLCN_ROOT`) when validating unpublished vendor changes.

Use source mode from [`3rd-party/README.md`](../3rd-party/README.md) for local unpublished vendor testing.
This document is a compatibility reference only when running legacy workflows that still call:

- `scripts/build_vlcn.sh`
- `scripts/compare_artefacts_version.sh`
- `scripts/artefacts-download.sh`
- `scripts/artefacts-upload.sh`

If your goal is normal Librocco work, prefer:

```bash
rush install
```

CI jobs and scripts that still depend on this artefact flow should be audited before removal.

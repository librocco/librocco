# Legacy Artefact Workflow (R2)

This document describes the legacy `3rd-party/artefacts` flow that is still present in the repository for compatibility.

The current supported dependency path for Librocco is registry-based:

- Install dependencies from `npm.codemyriad.io` by default.
- Use local source mode (`VLCN_ROOT`) when validating unpublished vendor changes.

Keep this document as a reference only when running workflows that still call:

- `scripts/build_vlcn.sh`
- `scripts/compare_artefacts_version.sh`
- `scripts/artefacts-download.sh`
- `scripts/artefacts-upload.sh`

If your goal is normal Librocco work, prefer:

```bash
rush install
./scripts/publish_vlcn.sh --help
```

For unpublished vendor testing, use source mode instead:

```bash
./scripts/prepare_vlcn_source.sh
VLCN_ROOT=3rd-party/js cd apps/web-client && rushx typecheck
```

Use `./scripts/publish_vlcn.sh --help` to verify publish flags including `--dry-run`.

CI jobs and scripts that still depend on this artefact flow should be audited before removal.

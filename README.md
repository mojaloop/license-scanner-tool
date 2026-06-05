# @mojaloop/license-scanner-tool

SBOM-first license-compliance gate for Mojaloop. It evaluates a **CycloneDX**
SBOM, normalises component licences to canonical **SPDX**, and fails if any npm
dependency's licence is not on a curated allowlist.

This replaces the legacy bash tool (Syft-less, `eval`/`docker cp` based, depended
on an unmaintained `license-checker` fork). The old tool is **deprecated** and
kept only until consumers move to `mojaloop/build@>=2.0.0` — see
[Legacy tool](#legacy-tool-deprecated).

## Install / run

```bash
# one-time: install Syft (only needed when scanning a directory; see "Where the SBOM comes from")
brew install syft

# scan the current repo (the tool builds the SBOM with Syft, then gates it)
npx @mojaloop/license-scanner-tool .

# gate a pre-generated CycloneDX SBOM (no Syft needed)
npx @mojaloop/license-scanner-tool sbom.cdx.json

# non-blocking: report violations but exit 0 (used during migration windows)
npx @mojaloop/license-scanner-tool --warn .
```
Exit codes: `0` pass (or `--warn`), `1` violations, `2` usage/tool error.

## Where the SBOM comes from

The tool accepts **either** a CycloneDX SBOM file **or** a path to scan, so it
works the same in CI and locally — but *who builds the SBOM* differs:

| Context | Who runs Syft | What the tool receives |
|---|---|---|
| **CI (mojaloop/build orb)** | the **orb** (`generate_sbom`) | a pre-built `sbom.cdx.json` — the tool **consumes** it, does not re-run Syft |
| **Local / git hook / standalone** | the **tool** (`cli.js`) | a directory (e.g. `.`) — the tool runs `syft dir:.` itself, then gates |

**Why the orb builds it in CI** (deliberate, "one SBOM, many gates"):

1. The orb generates the SBOM **once** and feeds the *same* artifact to both the
   vulnerability scan (`grype_scan`) and this license gate — no double Syft runs.
2. `license_scan` gates a Docker **image**, not a source tree; the orb's
   `generate_sbom` handles images and directories uniformly. The tool's own
   generation path only scans source directories.

So in CI: **orb creates the SBOM → tool gates it.** Locally: **tool creates and
gates** in one step. Either way the verdict is identical because both feed the
same policy ([data.json](data.json)).

## How a scan is evaluated

1. **Scope** — only `pkg:npm/` components are gated. Syft also catalogues
   workflow YAMLs, lockfiles and binaries; those are ignored.
2. **Normalise** — a component's licence is resolved to an SPDX id/expression
   **only** via the curated alias map (`data.json → aliases`). Proprietary
   markers like `UNLICENSED` are never "corrected". Anything unresolved is
   **undetermined**. ([src/normalize.js](src/normalize.js))
3. **Gate** — the SPDX id/expression is checked against the allowlist;
   per-package `exceptions` (with expiry) waive findings.
   ([src/gate.js](src/gate.js))

---

## Handling a license-scan failure

When the gate fails you get one or both of these, listed **per package** (all at
once — the scan does not stop at the first):

```
DISALLOWED: npm package foo@1.2.0 uses licence "GPL-3.0-only", which is not on the allowlist (data.json -> allowed).
UNDETERMINED: npm package bar@0.3.1 declares licence "Free for all", which is not a recognised SPDX id. Verify the real licence, then add a vetted alias or exception.
```

> **Do not "make it pass" blindly.** A failure is a question, not a bug. Resolve
> each finding deliberately; every policy change is reviewed via PR and affects
> **all** Mojaloop repos that use this tool.

### Step 1 — verify the real licence

Before changing anything, find out what the package is *actually* licensed under:

- the package's **repository `LICENSE` file** (most authoritative),
- its **`package.json` `license` field**,
- its **npm page** (`https://www.npmjs.com/package/<name>`),
- the **SBOM entry** — the message quotes the declared string (e.g. `"Free for all"`)
  so you can see exactly what the package put in its metadata.

### Step 2 — pick the right resolution

| Finding | What you confirmed | Action |
|---|---|---|
| **DISALLOWED** | A valid, **permissive** SPDX licence missing from the allowlist (e.g. `MIT-0`, `0BSD`) | Add the SPDX id to `data.json → allowed`. |
| **DISALLOWED** | A **copyleft / incompatible** licence (e.g. `GPL-3.0-only`, `AGPL`) | The gate is **correct** — do **not** allowlist it. Remove or replace the dependency. |
| **UNDETERMINED** | The package declares a valid licence as **free text** (e.g. `"Apache 2.0"`, `"BSD License"`) | Add a vetted entry to `data.json → aliases`: `"<declared string>": "<SPDX id>"`. |
| **UNDETERMINED** | The package has **no machine-readable licence**, but you confirmed a real, acceptable licence elsewhere (e.g. MIT on GitHub, missing from `package.json`) | Add a dated **exception** to `data.json → exceptions`. |
| **UNDETERMINED** | You **cannot** determine or trust the licence | Treat as a blocker — replace the dependency. |

### Step 3 — make the change (examples)

**Allow a permissive licence** — add the SPDX id:
```jsonc
// data.json → licenses.allowed
"allowed": [ "...", "MIT-0" ]
```

**Add a vetted alias** — map a verified free-text string to an SPDX id:
```jsonc
// data.json → licenses.aliases
"aliases": {
  "Apache 2.0": "Apache-2.0"   // declared string -> canonical SPDX id
}
```

**Add an exception** — waive a specific package@version, with a reason and an
**expiry** so it is revisited:
```jsonc
// data.json → licenses.exceptions
"exceptions": {
  "some-pkg@1.4.2": { "reason": "MIT on GitHub, not in package.json", "expires": "2027-01-01" }
}
```

### Hard rules

- **Never** add `UNLICENSED` (or any proprietary marker) to `allowed` or
  `aliases` — npm's `UNLICENSED` means *no rights granted*; the validator rejects it.
- **Never blanket-except** an undetermined finding — verify the actual licence first.
- **Exceptions must carry an `expires` date** (the validator warns on expired ones).
- Prefer fixing the dependency or adding a precise alias over a broad exception.

### Step 4 — validate and re-run locally

```bash
npm run validate                          # SPDX-lint data.json (fails on a bad id/alias/expiry)
npx @mojaloop/license-scanner-tool .      # re-run the gate; should now pass
```
Open a PR with the `data.json` change. Once released, every consuming repo picks
it up via the package version.

### Unblocking a build while you reconcile

During a migration window (or while a fix is in review) a repo can run the gate
non-blocking so it reports without failing:

```bash
npx @mojaloop/license-scanner-tool --warn .
```
In the orb, this is the `license_gate` `warn: true` parameter. **Use sparingly**
— a warn-mode gate does not actually enforce compliance.

---

## Editing the policy ([data.json](data.json))

| Field | Purpose |
|---|---|
| `allowed` | Permitted canonical SPDX ids / expressions. |
| `aliases` | Reviewed free-text → SPDX mappings (reject-by-default). |
| `exceptions` | Per-package waivers (`name@version` → reason + `expires`). |

All entries are SPDX-validated at build time (`npm run validate`).

## Local pre-flight & git hook

Enforce before push (repo with husky):
```bash
printf 'npx --yes @mojaloop/license-scanner-tool@^1 .\n' > .husky/pre-push
```
Or copy [hooks/pre-push](hooks/pre-push) to `.git/hooks/pre-push`. Bypass once
with `LICENSE_CHECK_SKIP=1 git push`.

## Development

The Node version is pinned in [.nvmrc](.nvmrc) (and used by CI via nvm, matching
the orb convention).

```bash
nvm use            # node version from .nvmrc
npm ci
npm run validate   # SPDX-lint data.json
npm test           # gate unit tests (node --test)
node src/cli.js .  # run the gate locally
```

## CI / publishing

This repo uses a **standalone** CircleCI pipeline ([.circleci/config.yml](.circleci/config.yml))
that publishes to npm on a `vX.Y.Z` tag. It deliberately does **not** use the
`mojaloop/build` orb, because this package is a dependency of that orb's license
gate — using the orb here would be circular.

## Legacy tool (removed)

The previous `make build` / `config.toml` bash tool has been **removed**. It relied
on an unmaintained `license-checker` fork and used `eval` / `docker cp` — the
supply-chain and command-injection risks this package was created to eliminate.

The `Makefile` is now a stub that exits non-zero with upgrade guidance. If your CI
still uses the old `mojaloop/build` license path (`git clone … && make build`), it
will fail by design — upgrade to **`mojaloop/build@>=2.0.0`**, which runs
`npx @mojaloop/license-scanner-tool`.

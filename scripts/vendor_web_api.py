#!/usr/bin/env python3
"""Keep web/api/hedge_fund/ in sync with the root hedge_fund/ package.

web/api/hedge_fund/ is a trimmed copy of the root package, vendored so the
Vercel Python function is self-contained under its Root Directory (web/).
See web/api/hedge_fund/__init__.py for why.

That copy is the code the deployed site actually runs. So an upstream sync
that updates the root package and not this copy leaves the site running old
logic while every commit says otherwise — it looks synced and deployed, and
nothing changed. This script closes that gap.

Two files carry deliberate local edits and are never overwritten:

  __init__.py      the vendoring note
  signals/base.py  the numpy/pandas trim (~158MB; see web/requirements.txt)

For those, the root file's hash is recorded in .vendor-manifest.json. If
upstream changes one of them, the edit has to be re-applied by hand, so this
script refuses to proceed rather than silently clobbering or ignoring it.

    python3 scripts/vendor_web_api.py            # re-vendor
    python3 scripts/vendor_web_api.py --check    # CI: fail on any drift
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "hedge_fund"
DST = ROOT / "web" / "api" / "hedge_fund"
MANIFEST = DST / ".vendor-manifest.json"

# Only what the /api/run endpoint can reach. backtesting/, event_study/,
# tui/, and validation/ are excluded on purpose: they pull in scipy,
# matplotlib, and textual, none of which fit the function's size budget.
PACKAGES = [
    "data", "brokers", "fund", "risk", "pipeline",
    "portfolio", "signals", "llm", "features",
]
TOP_LEVEL = ["__init__.py", "models.py", "paths.py"]
DATA_FILES = ["llm/api_models.json", "fund/example.yaml"]

# Locally modified; copying over them would undo the edit.
PRESERVE = {"__init__.py", "signals/base.py"}


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _vendorable(path: Path) -> bool:
    return path.name != "conftest.py" and not path.name.startswith("test_")


def _sources() -> list[str]:
    """Every path (relative to the package root) this script manages."""
    rels: list[str] = []
    for name in TOP_LEVEL:
        if (SRC / name).exists():
            rels.append(name)
    for pkg in PACKAGES:
        for f in sorted((SRC / pkg).rglob("*.py")):
            if _vendorable(f):
                rels.append(str(f.relative_to(SRC)))
    for name in DATA_FILES:
        if (SRC / name).exists():
            rels.append(name)
    return sorted(set(rels))


def _load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"preserved": {}}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="report drift and exit 1; change nothing")
    args = ap.parse_args()

    if not SRC.is_dir():
        print(f"error: {SRC} not found", file=sys.stderr)
        return 2

    manifest = _load_manifest()
    preserved_hashes: dict[str, str] = dict(manifest.get("preserved", {}))

    stale: list[str] = []        # vendored copy differs from root
    needs_port: list[str] = []   # upstream changed a hand-edited file
    missing: list[str] = []      # in root, absent from the copy
    copied: list[str] = []

    for rel in _sources():
        src, dst = SRC / rel, DST / rel

        if rel in PRESERVE:
            recorded = preserved_hashes.get(rel)
            current = _sha(src)
            if recorded is None:
                preserved_hashes[rel] = current  # first run: adopt as baseline
            elif recorded != current:
                needs_port.append(rel)
            continue

        if not dst.exists():
            missing.append(rel)
        elif src.read_bytes() != dst.read_bytes():
            stale.append(rel)
        else:
            continue

        if not args.check:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            copied.append(rel)

    # A file dropped upstream must not linger in the copy.
    managed = set(_sources())
    orphans = [
        str(p.relative_to(DST))
        for p in sorted(DST.rglob("*"))
        if p.is_file()
        and p.name != ".vendor-manifest.json"
        and str(p.relative_to(DST)) not in managed
        and p.suffix in {".py", ".json", ".yaml"}
    ]

    if args.check:
        drift = stale + missing + needs_port + orphans
        if not drift:
            print(f"vendor check: OK — {len(managed)} files in sync")
            return 0
        print("vendor check: DRIFT DETECTED\n", file=sys.stderr)
        if stale or missing:
            print("  Out of date (run: python3 scripts/vendor_web_api.py):",
                  file=sys.stderr)
            for r in stale + missing:
                print(f"    {r}", file=sys.stderr)
        if needs_port:
            print("\n  Upstream changed a file carrying local edits — port by hand,",
                  file=sys.stderr)
            print("  then update .vendor-manifest.json:", file=sys.stderr)
            for r in needs_port:
                print(f"    {r}", file=sys.stderr)
        if orphans:
            print("\n  Vendored but no longer in the root package (delete):",
                  file=sys.stderr)
            for r in orphans:
                print(f"    {r}", file=sys.stderr)
        return 1

    if needs_port:
        print("refusing to re-vendor: upstream changed a hand-edited file.",
              file=sys.stderr)
        for r in needs_port:
            print(f"  {r}  (re-apply the local edit, then update "
                  f".vendor-manifest.json)", file=sys.stderr)
        return 1

    MANIFEST.write_text(json.dumps(
        {"note": "sha256 of the ROOT hedge_fund/ file each locally-edited "
                 "vendored file was last ported from; see "
                 "scripts/vendor_web_api.py",
         "preserved": preserved_hashes}, indent=2) + "\n")

    if copied:
        print(f"re-vendored {len(copied)} file(s):")
        for r in copied:
            print(f"  {r}")
    else:
        print("nothing to do — already in sync")
    if orphans:
        print("\nwarning: vendored files no longer in the root package:")
        for r in orphans:
            print(f"  {r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

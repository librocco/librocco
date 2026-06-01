#!/usr/bin/env python3
"""
extract-opfs-db.py — copy librocco's in-browser SQLite DB out of OPFS, read-only.

librocco stores its database in the browser's Origin Private File System (OPFS)
via wa-sqlite's OPFSCoopSyncVFS. Chromium-family browsers persist OPFS files
verbatim on disk under:

    <profile>/File System/<origin-id>/t/<NN>/<file-id>

i.e. each OPFS file is a single, contiguous backing file whose bytes ARE the
SQLite database (no pool, no sahpool header). Because librocco keeps the DB in
rollback-journal mode (not WAL), an at-rest database is a single self-consistent
file — so we can copy it while the browser keeps running, with no remote-debug
port and without touching the browser's own files.

This tool:
  * discovers Chromium/Brave/Chrome/Edge/Vivaldi profiles,
  * finds librocco OPFS databases by content (validates they're real librocco DBs),
  * copies the chosen one to an output path,
  * runs PRAGMA integrity_check on the copy, retrying if a concurrent write
    produced a torn read,
  * copies a hot -journal/-wal sidecar too (if a transaction was mid-flight) so
    SQLite can roll back to the last commit.

It only ever READS from the browser profile. Nothing is written inside it.

CAVEAT: this relies on UNDOCUMENTED Chromium on-disk OPFS layout, reverse-engineered
from current browser versions. It is not guaranteed by any vendor and may break with a
browser update. For a forward-stable copy, use librocco's in-app export (the /debug
route) instead, which uses the public OPFS API.

Usage:
    scripts/extract-opfs-db.py --list
    scripts/extract-opfs-db.py                       # newest librocco DB -> ./librocco-snapshot-<ts>.sqlite3
    scripts/extract-opfs-db.py --origin anand --out /tmp/store.sqlite3
    scripts/extract-opfs-db.py --db-name librocco_demo_db.sqlite3
"""
from __future__ import annotations

import argparse
import glob
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import time

SQLITE_MAGIC = b"SQLite format 3\x00"
JOURNAL_MAGIC = b"\xd9\xd5\x05\xf9\x20\xa1\x63\xd7"
WAL_MAGIC = (b"\x37\x7f\x06\x82", b"\x37\x7f\x06\x83")

# Browser config roots to probe (Linux). Add more if needed.
BROWSER_ROOTS = {
    "brave": "~/.config/BraveSoftware/Brave-Browser",
    "chrome": "~/.config/google-chrome",
    "chromium": "~/.config/chromium",
    "edge": "~/.config/microsoft-edge",
    "vivaldi": "~/.config/vivaldi",
}

# Tables that mark a database as "librocco" (cheap sanity gate).
LIBROCCO_MARKERS = {"crsql_master", "book", "warehouse", "customer", "note"}


def expand(p: str) -> str:
    return os.path.expanduser(p)


def iter_profiles():
    """Yield (browser, profile_dir) for every profile dir that has a File System/ store."""
    for browser, root in BROWSER_ROOTS.items():
        root = expand(root)
        if not os.path.isdir(root):
            continue
        for prof in ["Default"] + sorted(glob.glob(os.path.join(root, "Profile *"))):
            prof_dir = prof if os.path.isabs(prof) else os.path.join(root, prof)
            if os.path.isdir(os.path.join(prof_dir, "File System")):
                yield browser, prof_dir


def parse_origins(fs_root: str) -> dict[str, str]:
    """Best-effort map {origin-dir-number: origin-string} from the Origins leveldb log."""
    out: dict[str, str] = {}
    blob = b""
    for f in glob.glob(os.path.join(fs_root, "Origins", "*")):
        if os.path.isfile(f):
            try:
                blob += open(f, "rb").read()
            except OSError:
                pass
    for m in re.finditer(rb"ORIGIN:([\x20-\x7e]+?)(?=[\x00-\x1f])", blob):
        name = m.group(1).decode("latin1")
        tail = blob[m.end():m.end() + 12]
        d = re.search(rb"([0-2]\d\d)", tail)
        if d:
            out.setdefault(d.group(1).decode(), origin_to_url(name))
    return out


def origin_to_url(origin: str) -> str:
    """Turn Chromium's 'https_host_port' origin id into a readable URL."""
    m = re.match(r"(https?)_(.+)_(\d+)$", origin)
    if not m:
        return origin
    scheme, host, port = m.groups()
    default = "443" if scheme == "https" else "80"
    return f"{scheme}://{host}" + ("" if port in (default, "0") else f":{port}")


def classify(path: str) -> str | None:
    """Return 'db' | 'journal' | 'wal' | None by reading the file's magic."""
    try:
        with open(path, "rb") as f:
            head = f.read(16)
    except OSError:
        return None
    if head.startswith(SQLITE_MAGIC):
        return "db"
    if head.startswith(JOURNAL_MAGIC):
        return "journal"
    if head[:4] in WAL_MAGIC:
        return "wal"
    return None


def validate(db_path: str, recover: bool = False) -> dict | None:
    """Open the copy and confirm it's an intact librocco DB. Returns info or None."""
    try:
        if recover:
            # Normal open so SQLite folds in a hot rollback journal next to the file.
            con = sqlite3.connect(db_path)
        else:
            con = sqlite3.connect(f"file:{db_path}?mode=ro&immutable=1", uri=True)
    except sqlite3.Error:
        return None
    try:
        cur = con.cursor()
        if cur.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            return None
        tables = {r[0] for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        if not LIBROCCO_MARKERS.issubset(tables):
            return None
        schema = dict(cur.execute(
            "SELECT key, value FROM crsql_master WHERE key IN ('schema_name','schema_version')"
        ).fetchall())
        books = cur.execute("SELECT COUNT(*) FROM book").fetchone()[0]
        notes = cur.execute("SELECT COUNT(*) FROM note").fetchone()[0]
        return {"schema": schema, "books": books, "notes": notes,
                "tables": len(tables)}
    except sqlite3.Error:
        return None
    finally:
        con.close()


def find_candidates(db_name: str):
    """Yield dicts describing every librocco OPFS db backing file we can find."""
    seen = set()
    for browser, prof in iter_profiles():
        fs_root = os.path.join(prof, "File System")
        origins = parse_origins(fs_root)
        for origin_dir in sorted(glob.glob(os.path.join(fs_root, "[0-9]" * 3))):
            num = os.path.basename(origin_dir)
            # Only origin dirs whose Paths metadata mentions our db filename.
            paths_blob = b""
            for f in glob.glob(os.path.join(origin_dir, "t", "Paths", "*")):
                if os.path.isfile(f):
                    try:
                        paths_blob += open(f, "rb").read()
                    except OSError:
                        pass
            if db_name.encode() not in paths_blob:
                continue
            # Gather non-empty backing files in this origin's temp store.
            dbs, journals, wals = [], [], []
            for bf in glob.glob(os.path.join(origin_dir, "t", "[0-9]" * 2, "*")):
                try:
                    sz = os.path.getsize(bf)
                except OSError:
                    continue
                if sz == 0:
                    continue
                kind = classify(bf)
                if kind == "db":
                    dbs.append((bf, sz))
                elif kind == "journal":
                    journals.append((bf, sz))
                elif kind == "wal":
                    wals.append((bf, sz))
            if not dbs:
                continue
            # Main db = largest SQLite-magic file in the dir.
            main, sz = max(dbs, key=lambda t: t[1])
            key = (main,)
            if key in seen:
                continue
            seen.add(key)
            yield {
                "browser": browser, "profile": prof, "origin_dir": num,
                "origin": origins.get(num, f"(dir {num})"),
                "path": main, "size": sz, "mtime": os.path.getmtime(main),
                "journals": journals, "wals": wals,
            }


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


def cmd_list(db_name: str) -> int:
    rows = sorted(find_candidates(db_name), key=lambda c: c["mtime"], reverse=True)
    if not rows:
        print(f"No librocco OPFS databases found for db-name {db_name!r}.", file=sys.stderr)
        return 1
    print(f"Found {len(rows)} librocco database(s) for {db_name!r}:\n")
    for i, c in enumerate(rows):
        info = validate(c["path"]) or {}
        ts = time.strftime("%Y-%m-%d %H:%M", time.localtime(c["mtime"]))
        hot = " HOT-JOURNAL" if c["journals"] or c["wals"] else ""
        summary = (f"{info['books']} books, {info['notes']} notes"
                   if info else "UNVALIDATED / unreadable")
        print(f"[{i}] {c['origin']}  ({c['browser']})")
        print(f"     {ts}   {human(c['size'])}   {summary}{hot}")
        print(f"     {c['path']}")
    return 0


def copy_with_retry(cand: dict, out: str, retries: int = 5) -> dict:
    """Copy backing file(s) to `out`, validating; retry on torn reads."""
    out = os.path.abspath(out)
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    last = None
    for attempt in range(1, retries + 1):
        with tempfile.TemporaryDirectory() as td:
            tmp = os.path.join(td, "db.sqlite3")
            shutil.copy2(cand["path"], tmp)
            hot = False
            # Attach a hot rollback journal so SQLite can roll back to last commit.
            if cand["journals"]:
                jsrc = max(cand["journals"], key=lambda t: t[1])[0]
                shutil.copy2(jsrc, tmp + "-journal")
                hot = True
            info = validate(tmp, recover=hot)
            if info:
                # Re-copy the (possibly recovered) main file to the destination.
                shutil.copy2(tmp, out)
                info["recovered"] = hot
                info["attempts"] = attempt
                return info
            last = "integrity_check failed"
        time.sleep(0.4)  # let any in-flight browser write settle, then retry
    raise RuntimeError(f"Could not get a consistent copy after {retries} tries ({last}). "
                       "The DB may be under heavy concurrent writes; try again when idle.")


def cmd_extract(args) -> int:
    cands = sorted(find_candidates(args.db_name), key=lambda c: c["mtime"], reverse=True)
    if args.origin:
        cands = [c for c in cands if args.origin.lower() in c["origin"].lower()]
    if not cands:
        print("No matching librocco database found.", file=sys.stderr)
        return 1
    cand = cands[0]
    out = args.out or f"./librocco-snapshot-{time.strftime('%Y%m%d-%H%M%S')}.sqlite3"
    print(f"Source : {cand['origin']}  ({cand['browser']}, dir {cand['origin_dir']})")
    print(f"         {cand['path']}  [{human(cand['size'])}]")
    info = copy_with_retry(cand, out, retries=args.retries)
    print(f"Output : {os.path.abspath(out)}")
    print(f"Verify : integrity_check ok | {info['books']} books, {info['notes']} notes, "
          f"{info['tables']} tables | schema={info['schema'].get('schema_name')}"
          f"{' | rolled back hot journal' if info['recovered'] else ''}"
          f"{' | attempts=' + str(info['attempts']) if info['attempts'] > 1 else ''}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Copy librocco's OPFS SQLite DB out, read-only.")
    ap.add_argument("--list", action="store_true", help="list databases instead of extracting")
    ap.add_argument("--out", help="output path (default ./librocco-snapshot-<ts>.sqlite3)")
    ap.add_argument("--origin", help="substring filter on origin URL (e.g. 'anand', 'localhost')")
    ap.add_argument("--db-name", default="librocco_current.sqlite3",
                    help="OPFS db filename (default librocco_current.sqlite3; "
                         "demo is librocco_demo_db.sqlite3)")
    ap.add_argument("--retries", type=int, default=5, help="torn-read retries (default 5)")
    args = ap.parse_args()
    try:
        return cmd_list(args.db_name) if args.list else cmd_extract(args)
    except KeyboardInterrupt:
        return 130
    except RuntimeError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

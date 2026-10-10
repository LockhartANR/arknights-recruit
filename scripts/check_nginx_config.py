#!/usr/bin/env python3
"""
Report whether the repo's nginx.conf still matches the live nginx config.

Why not a plain checksum or a line-by-line diff:
  * The repo copy carries its own warning header (extra comments), so checksums
    of the two files never match.
  * Blank lines and comments are stripped before comparing, so a plain diff of the
    stripped output misreports pure block reordering as a real difference.

So compare a MULTISET of effective directives plus the count of `server {` blocks.
That tolerates comment/blank-line/ordering differences while still catching any
directive that exists on one side only.

Read-only: never writes to either file. Safe to run from update.sh.

Exit codes:
  0  equivalent  - live config carries the same directives as the repo copy
  1  drifted     - one side has directives the other lacks
  2  unreadable  - a file is missing
"""

import os
import re
import sys
from collections import Counter

REPO = "/home/arknights/arknights-recruit/nginx.conf"
LIVE = "/etc/nginx/sites-available/arknights"

COMMENT = re.compile(r"#.*$")
SERVER_OPEN = re.compile(r"^server\s*\{$")


def effective(path):
    """Directives with comments and blank lines removed, in file order."""
    out = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = COMMENT.sub("", line).strip()
            if line:
                out.append(line)
    return out


def main():
    for path in (REPO, LIVE):
        if not os.path.exists(path):
            print(f"nginx-config-check: cannot read {path}", file=sys.stderr)
            return 2

    try:
        repo = effective(REPO)
        live = effective(LIVE)
    except OSError as exc:
        print(f"nginx-config-check: read failed: {exc}", file=sys.stderr)
        return 2

    repo_blocks = sum(1 for line in repo if SERVER_OPEN.match(line))
    live_blocks = sum(1 for line in live if SERVER_OPEN.match(line))

    print(f"nginx-config-check: repo = {len(repo)} directives / {repo_blocks} server blocks")
    print(f"nginx-config-check: live = {len(live)} directives / {live_blocks} server blocks")

    if Counter(repo) == Counter(live) and repo_blocks == live_blocks:
        print("nginx-config-check: OK - repo nginx.conf is equivalent to the live config")
        return 0

    print("nginx-config-check: DRIFT DETECTED", file=sys.stderr)
    if repo_blocks != live_blocks:
        print(
            f"  server blocks differ: repo={repo_blocks} live={live_blocks}",
            file=sys.stderr,
        )
    for label, diff in (
        ("only in repo", Counter(repo) - Counter(live)),
        ("only in live", Counter(live) - Counter(repo)),
    ):
        for directive, count in sorted(diff.items()):
            print(f"  {label} (x{count}): {directive}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())

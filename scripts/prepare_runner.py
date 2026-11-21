#!/usr/bin/env python3
"""Put a real GenVM runner archive where genvm-lint and gltest can read it.

genvm v0.3.0-rc7, which GitHub currently marks latest, does not publish
genvm-universal.tar.xz. The asset is genvm-runners-all.tar.xz. gltest still
requests the old name and gets a 404. This downloads the published asset once
and stores it under the filename both tools already understand.

The contract keeps the runner hash pinned by the Internet Court GenLayer skill.
That hash is inside this archive, next to a newer hash the linter only mentions.
"""

from __future__ import annotations

import shutil
import urllib.request
from pathlib import Path

VERSION = "v0.3.0-rc7"
URL = f"https://github.com/genlayerlabs/genvm/releases/download/{VERSION}/genvm-runners-all.tar.xz"
NAME = f"genvm-universal-{VERSION}.tar.xz"


def place(directory: Path, source: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / NAME
    if target.exists() and target.stat().st_size > 1_000_000:
        print("present", target)
        return
    if target.is_symlink() or target.exists():
        target.unlink()
    shutil.copyfile(source, target)
    print("placed", target)


def main() -> None:
    cache = Path.home() / ".cache" / "git-escrow-court"
    cache.mkdir(parents=True, exist_ok=True)
    source = cache / "genvm-runners-all.tar.xz"
    if not source.exists() or source.stat().st_size < 1_000_000:
        print("downloading", URL)
        request = urllib.request.Request(URL, headers={"User-Agent": "git-escrow-court"})
        with urllib.request.urlopen(request, timeout=300) as response, source.open("wb") as handle:
            shutil.copyfileobj(response, handle)
    place(Path.home() / ".cache" / "genvm-linter", source)
    place(Path.home() / ".cache" / "gltest-direct", source)


if __name__ == "__main__":
    main()

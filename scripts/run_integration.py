#!/usr/bin/env python3
"""Start GLSim on an uncommon port and run the official gltest integration file.

The process is local. genlayer-py 0.16.3 names its localnet object with chain
id 61999, which is also Studionet's public chain id. GLSim is started with
61127, the chain id in the public localnet docs and in glsim itself. Traffic
stays on 127.0.0.1.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG = ROOT / "artifacts" / "logs"
LOG.mkdir(parents=True, exist_ok=True)
PORT = 40117
URL = f"http://127.0.0.1:{PORT}/api"


def rpc_ready() -> bool:
    body = b'{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
    request = urllib.request.Request(URL, data=body, headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            return response.status == 200
    except Exception:
        return False


def main() -> int:
    sim_log = open(LOG / "glsim.log", "w", encoding="utf-8")
    env = {**os.environ, "PATH": os.path.expanduser("~/.local/bin") + os.pathsep + os.environ.get("PATH", "")}
    sim = subprocess.Popen(
        [
            "glsim",
            "--host",
            "127.0.0.1",
            "--port",
            str(PORT),
            "--chain-id",
            "61127",
            "--validators",
            "5",
            "--no-browser",
            "--seed",
            "git-escrow-court",
        ],
        cwd=ROOT,
        stdout=sim_log,
        stderr=subprocess.STDOUT,
        env=env,
    )
    try:
        for _ in range(40):
            if rpc_ready():
                break
            if sim.poll() is not None:
                print("glsim exited before it answered", file=sys.stderr)
                return 1
            time.sleep(0.25)
        else:
            print("glsim did not answer on", URL, file=sys.stderr)
            return 1
        out = open(LOG / "integration.log", "w", encoding="utf-8")
        completed = subprocess.run(
            ["gltest", "tests/integration", "-v", "-s", "--network", "localnet"],
            cwd=ROOT,
            stdout=out,
            stderr=subprocess.STDOUT,
            env=env,
        )
        out.close()
        text = (LOG / "integration.log").read_text(encoding="utf-8")
        sys.stdout.write(text)
        return completed.returncode
    finally:
        sim.send_signal(signal.SIGTERM)
        try:
            sim.wait(timeout=5)
        except subprocess.TimeoutExpired:
            sim.kill()
        sim_log.close()


if __name__ == "__main__":
    raise SystemExit(main())

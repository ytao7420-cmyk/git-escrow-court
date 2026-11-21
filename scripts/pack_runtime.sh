#!/bin/bash
# Assemble a standalone runtime the parent can start with ./start.sh.
# Does not replace an older tarball.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="${1:-/tmp/git-escrow-court-runtime-v5}"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -a "$ROOT/.next/standalone/." "$STAGE/"
mkdir -p "$STAGE/.next/static" "$STAGE/public"
cp -a "$ROOT/.next/static/." "$STAGE/.next/static/"
cp -a "$ROOT/public/." "$STAGE/public/"
cp -a "$ROOT/contracts" "$ROOT/court" "$ROOT/fixtures" "$ROOT/scripts" "$STAGE/"
cp "$ROOT/requirements.txt" "$ROOT/env.example" "$STAGE/"
cat > "$STAGE/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
export PORT="${PORT:-43123}"
export HOSTNAME="0.0.0.0"
echo "Open http://127.0.0.1:${PORT}/wallet"
echo "Local fixture review also needs: python3 -m pip install -r requirements.txt && python3 scripts/prepare_runner.py"
exec node server.js
EOF
chmod +x "$STAGE/start.sh"
cat > "$STAGE/START.txt" << 'EOF'
在自己的电脑上运行，不需要克隆仓库。需要 Node.js 20 或更新版本。
这是独立的第五份运行包。不要覆盖正在运行的目录。先停掉旧进程，再解压这一份并运行 ./start.sh。
部署和案件都已经写入。两个按钮都只读，不会再发送。

部署 0x3245ee1f95c3aad8529a0732b105be5d43fc52c6c726807a18c24241b4d3d76f
合约 0x37383a73306B8F31d9158C3419C29EED856cc1Bc
案件 0xf95e4d26e5cb3aaa836b0e3632c606da0f4e476d3fb98c6844fbea73818e1fc7
get_record decision escalate，violation missing-test-result。执行成功不等于这个判断。

1. 解压后运行 ./start.sh
2. 打开 http://127.0.0.1:43123/public
   上方卡片来自 Studionet get_record，不是本地夹具。
3. 用页面上的「部署与读回」看部署哈希。不要再点部署或提交。
EOF
(
  cd "$STAGE"
  find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
)
echo "$STAGE"

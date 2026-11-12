#!/bin/bash
# 编译「薪水铸币厂」macOS 应用：通用二进制 + 资源打包 + ad-hoc 签名
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# 网页资源默认取仓库根的 web/，可用 WEB_DIR 覆盖
WEB_DIR="${WEB_DIR:-$ROOT/../web}"
APP_NAME="薪水铸币厂"
APP="$ROOT/build/$APP_NAME.app"
BIN_ARM="$ROOT/build/SalaryMint-arm64"
BIN_X86="$ROOT/build/SalaryMint-x86_64"

if [ ! -f "$WEB_DIR/index.html" ]; then
  echo "ERROR: 找不到网页资源：$WEB_DIR/index.html" >&2
  exit 1
fi

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web"

cp "$ROOT/Info.plist" "$APP/Contents/Info.plist"
cp -R "$WEB_DIR/." "$APP/Contents/Resources/web/"
if [ -f "$ROOT/assets/AppIcon.icns" ]; then
  cp "$ROOT/assets/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
fi

SOURCES=("$ROOT/src/"*.swift)
echo "编译 arm64…"
swiftc -O -swift-version 5 -target arm64-apple-macos13.0 "${SOURCES[@]}" -o "$BIN_ARM"
echo "编译 x86_64…"
swiftc -O -swift-version 5 -target x86_64-apple-macos13.0 "${SOURCES[@]}" -o "$BIN_X86"

lipo -create -output "$APP/Contents/MacOS/SalaryMint" "$BIN_ARM" "$BIN_X86"
chmod +x "$APP/Contents/MacOS/SalaryMint"

echo "签名（ad-hoc）…"
codesign --force --deep --sign - --timestamp=none "$APP" >/dev/null 2>&1 || true
codesign --force --sign - "$APP" >/dev/null 2>&1 || true

echo "产物：$APP"
du -sh "$APP"
lipo -info "$APP/Contents/MacOS/SalaryMint"

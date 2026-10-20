#!/usr/bin/env bash
# Builds the macOS downloads, phat_<version>_x64.dmg for Intel and
# phat_<version>_aarch64.dmg for Apple silicon, each signed with the
# Developer ID certificate, notarized and stapled. Run it on the maintainer's
# Mac from the repository root after the web build is current; the DMGs land
# in the directory given as the first argument (default dist-mac).
set -euo pipefail

VERSION=$(grep "Version =" internal/buildinfo/VERSION.go | cut -d '"' -f2)
IDENTITY="${PHAT_SIGN_ID:-Developer ID Application: Dennis Mojado (XY8V9KCL4H)}"
PROFILE="${PHAT_NOTARY_PROFILE:-phat-notary}"
OUT="${1:-dist-mac}"
mkdir -p "$OUT"

# A signed download carries the toolchain's standard library with it, so a
# known vulnerability in either stops the build before anything is signed.
go tool govulncheck ./...

# Go names the architectures amd64 and arm64; the downloads use x64 and
# aarch64, the names most macOS projects on GitHub publish under.
for pair in amd64:x64 arm64:aarch64; do
	goarch=${pair%%:*}
	label=${pair##*:}
	name="phat_${VERSION}_${label}"
	stage="$OUT/$name"
	rm -rf "$stage" "$OUT/$name.dmg"
	mkdir -p "$stage"

	echo "Building $name..."
	GOOS=darwin GOARCH=$goarch CGO_ENABLED=1 go build -trimpath -o "$stage/phat" .
	codesign --force --options runtime --timestamp --sign "$IDENTITY" "$stage/phat"
	ditto LICENSE "$stage/LICENSE"
	ditto README.md "$stage/README.md"

	hdiutil create -quiet -volname "Phat $VERSION" -srcfolder "$stage" -format UDZO "$OUT/$name.dmg"
	codesign --force --timestamp --sign "$IDENTITY" "$OUT/$name.dmg"
	xcrun notarytool submit "$OUT/$name.dmg" --keychain-profile "$PROFILE" --wait
	xcrun stapler staple "$OUT/$name.dmg"
	rm -rf "$stage"
done

ls -l "$OUT"/*.dmg

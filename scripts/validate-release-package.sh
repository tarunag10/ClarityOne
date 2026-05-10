#!/bin/bash
set -euo pipefail

ZIP_PATHS=("$@")

if [ "${#ZIP_PATHS[@]}" -eq 0 ]; then
  for candidate in dist/clarityone-chrome.zip dist/clarityone-chrome-tester.zip dist/clarityone-safari.zip; do
    if [ -f "$candidate" ]; then
      ZIP_PATHS+=("$candidate")
    fi
  done
  for candidate in dist/releases/clarityone-test-v*/clarityone-*.zip; do
    if [ -f "$candidate" ]; then
      ZIP_PATHS+=("$candidate")
    fi
  done
fi

if [ "${#ZIP_PATHS[@]}" -eq 0 ]; then
  echo "No release package zip files found to validate."
  exit 1
fi

require_file() {
  local root="$1"
  local rel="$2"
  if [ ! -f "$root/$rel" ]; then
    echo "Missing expected file in package: $rel"
    return 1
  fi
}

find_extension_root() {
  local unzip_dir="$1"
  local manifest
  manifest="$(find "$unzip_dir" -type f -name manifest.json | head -n 1 || true)"
  if [ -z "$manifest" ]; then
    return 1
  fi
  dirname "$manifest"
}

validate_zip() {
  local zip_path="$1"
  local tmp_dir
  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/clarityone-zip-validate.XXXXXX")"
  trap 'rm -rf "$tmp_dir"' RETURN

  echo "Validating $zip_path"
  unzip -qq "$zip_path" -d "$tmp_dir"

  if find "$tmp_dir" \( -name ".DS_Store" -o -path "*/__MACOSX/*" -o -name "__MACOSX" \) | grep -q .; then
    echo "Package contains macOS metadata (.DS_Store or __MACOSX): $zip_path"
    return 1
  fi

  local extension_root
  if ! extension_root="$(find_extension_root "$tmp_dir")"; then
    echo "Package is missing manifest.json: $zip_path"
    return 1
  fi

  require_file "$extension_root" "manifest.json"
  require_file "$extension_root" "background.js"
  require_file "$extension_root" "content.js"
  require_file "$extension_root" "content.css"
  require_file "$extension_root" "popup.html"
  require_file "$extension_root" "popup.js"
  require_file "$extension_root" "popup.css"
  require_file "$extension_root" "icons/icon-16.png"
  require_file "$extension_root" "icons/icon-48.png"
  require_file "$extension_root" "icons/icon-128.png"

  node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$extension_root/manifest.json"
}

for zip_path in "${ZIP_PATHS[@]}"; do
  if [ ! -f "$zip_path" ]; then
    echo "Zip file not found: $zip_path"
    exit 1
  fi
  validate_zip "$zip_path"
done

echo "Release package validation passed."

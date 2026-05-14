#!/bin/zsh

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$PWD}"

osascript <<OSA
tell application "Terminal"
  activate
  do script "cd " & quoted form of POSIX path of "${PROJECT_DIR}" & " && bun run dev"
end tell
OSA

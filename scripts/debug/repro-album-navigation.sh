#!/usr/bin/env bash

set -euo pipefail

ADB="/Users/M1PRO/Library/Android/sdk/platform-tools/adb"
PACKAGE="com.alghurobaa.podcast.dev"
REMOTE_XML="/sdcard/alghurobaa-album-repro.xml"
LOCAL_XML="/private/tmp/alghurobaa-album-repro.xml"

dump_ui() {
  local attempt
  local captured=0
  for attempt in 1 2 3; do
    if "$ADB" shell uiautomator dump "$REMOTE_XML" >/dev/null 2>&1; then
      captured=1
      break
    fi
    sleep 1
  done
  if [[ "$captured" == "0" ]]; then
    echo "SETUP FAILED: could not capture the app UI"
    exit 2
  fi
  "$ADB" pull "$REMOTE_XML" "$LOCAL_XML" >/dev/null
}

dump_ui

# Normalize the foreground app to the home screen after an interrupted run.
if rg -q 'text="Albums".*bounds="\[157,126\]\[922,189\]"' "$LOCAL_XML"; then
  "$ADB" shell input keyevent KEYCODE_BACK
  sleep 1
  dump_ui
fi

if rg -q 'content-desc="close modal"' "$LOCAL_XML"; then
  "$ADB" shell input tap 1020 1110
  sleep 1
  dump_ui
fi

if ! rg -q 'text="Explore the library"' "$LOCAL_XML"; then
  echo "SETUP FAILED: app is not on the home page"
  exit 2
fi

# "See all" in the Albums section on the 1080x2340 connected test device.
"$ADB" shell input tap 990 2060
sleep 4
dump_ui

if ! rg -q 'text="Albums".*bounds="\[157,126\]\[922,189\]"' "$LOCAL_XML"; then
  echo "SETUP FAILED: See All Albums did not open"
  exit 2
fi

# First album card: "شرح الإقناع لابن المنذر".
sleep 2
"$ADB" shell input tap 262 548
sleep 5
dump_ui

if rg -q 'text="Explore the library"' "$LOCAL_XML"; then
  echo "FAIL: tapping an album returned to the home page"
  exit 1
fi

echo "PASS: tapping an album stayed off the home page"

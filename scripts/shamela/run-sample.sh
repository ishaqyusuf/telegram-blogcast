#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

# This sample is pinned to the official 1448 archive's small _7iq segment.
# The segment contains the complete 351-page book 2094.
mkdir -p .shamela-cache/lib .shamela-cache/classes
for artifact in lucene-core lucene-backward-codecs; do
  target=".shamela-cache/lib/${artifact}-10.4.0.jar"
  url="https://repo.maven.apache.org/maven2/org/apache/lucene/${artifact}/10.4.0/${artifact}-10.4.0.jar"
  if [[ ! -f "$target" ]]; then
    curl -fsSL --max-time 120 "$url" -o "${target}.partial"
    mv "${target}.partial" "$target"
  fi
  curl -fsSL --max-time 30 "${url}.sha512" -o "${target}.sha512"
  python3 - "$target" <<'PY'
import hashlib, pathlib, sys
p = pathlib.Path(sys.argv[1])
expected = pathlib.Path(str(p) + '.sha512').read_text().split()[0]
if hashlib.sha512(p.read_bytes()).hexdigest() != expected:
    raise SystemExit('Lucene dependency checksum mismatch: ' + str(p))
PY
done

python3 scripts/shamela/archive.py --fetch \
  --match 'database/(master\.db|book/094/2094\.db|store/page/(segments_[^/]+|[^/]+\.si|_7iq\.cf[es]))$'

# JAVA_BIN may point to any Java 21+ JDK. Homebrew's current JDK is preferred.
java_bin="${JAVA_BIN:-java}"
if [[ -z "${JAVA_BIN:-}" && -x /opt/homebrew/opt/openjdk/bin/java ]]; then
  java_bin=/opt/homebrew/opt/openjdk/bin/java
fi
javac_bin="$(dirname "$(command -v "$java_bin")")/javac"
"$javac_bin" -cp '.shamela-cache/lib/*' -d .shamela-cache/classes scripts/shamela/ShamelaSegmentExport.java
"$java_bin" --enable-native-access=ALL-UNNAMED --add-modules jdk.incubator.vector \
  -cp '.shamela-cache/classes:.shamela-cache/lib/*' \
  org.apache.lucene.index.ShamelaSegmentExport \
  .shamela-cache/snapshot/database/store/page _7iq .shamela-cache/sample-pages.jsonl
python3 scripts/shamela/assemble.py --book 2094 \
  --pages .shamela-cache/sample-pages.jsonl --output .shamela-cache/books/2094.json

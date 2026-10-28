"""Inspect the released APK itself; never changes the device or app data."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from zipfile import ZipFile

apk = Path(sys.argv[1])
sdk = Path(os.environ.get("ANDROID_HOME", str(Path.home() / "Library/Android/sdk")))
build_tools = sdk / "build-tools/36.0.0"
badging = subprocess.check_output([str(build_tools / "aapt"), "dump", "badging", str(apk)], text=True)
package = re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'", badging)
assert package and package.groups() == ("com.alghurobaa.podcast.preview", "27", "1.0.112"), "Wrong package/version"
resources = subprocess.check_output([str(build_tools / "aapt"), "dump", "--values", "resources", str(apk)], text=True)
runtime = re.search(r"(?m)^\s*resource .*:string/expo_runtime_version:.*\n\s*\(string8\) \"([^\"]+)\"", resources)
assert runtime and runtime[1] == "1.0.112", "Wrong native OTA runtime"
with ZipFile(apk) as archive:
    config = json.loads(archive.read("assets/app.config"))
    assert config["name"] == "Al-Ghurobaa Preview"
    assert config["version"] == "1.0.112"
    assert config["android"]["package"] == package[1]
    assert config["extra"]["appVariant"] == "preview"
    assert config["extra"]["updateVersion"] == "2026.10.28"
    assert "lib/arm64-v8a/libreanimated.so" in archive.namelist()
    assert archive.getinfo("assets/index.android.bundle").file_size > 0
signature = subprocess.check_output([str(build_tools / "apksigner"), "verify", "--print-certs", str(apk)], text=True)
cert = re.search(r"certificate SHA-256 digest: (\w+)", signature)
assert cert, "APK signature verification failed"
proof = {
    "androidPackage": package[1], "versionCode": int(package[2]), "appVersion": package[3],
    "nativeRuntime": runtime[1], "displayVersion": config["extra"]["updateVersion"],
    "appVariant": config["extra"]["appVariant"], "apkBytes": apk.stat().st_size,
    "apkSha256": hashlib.sha256(apk.read_bytes()).hexdigest(), "certificateSha256": cert[1],
    "embeddedBundlePresent": True, "arm64ReanimatedLibraryPresent": True,
}
(Path(__file__).parent / "apk-proof.json").write_text(json.dumps(proof, indent=2) + "\n")
print(json.dumps(proof))

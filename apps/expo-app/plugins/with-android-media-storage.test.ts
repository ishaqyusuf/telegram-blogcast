import { describe, expect, test } from "bun:test";

const { addAndroidMediaStoragePackage } =
  require("./with-android-media-storage.js") as {
    addAndroidMediaStoragePackage: (
      source: string,
      packageName?: string,
    ) => string;
  };

describe("with-android-media-storage", () => {
  test("registers the package without depending on another custom package", () => {
    const source = `import com.facebook.react.ReactPackage

PackageList(this).packages.apply {
  // Packages can be added manually here.
}`;

    const once = addAndroidMediaStoragePackage(source);
    const twice = addAndroidMediaStoragePackage(once);

    expect(once).toContain(
      "import com.alghurobaa.podcast.media.AndroidMediaStoragePackage",
    );
    expect(once).toContain("add(AndroidMediaStoragePackage())");
    expect(twice).toBe(once);
  });

  test("replaces a stale package import when the app variant changes", () => {
    const source = `import com.facebook.react.ReactPackage
import com.alghurobaa.podcast.media.AndroidMediaStoragePackage

PackageList(this).packages.apply {
  add(AndroidMediaStoragePackage())
}`;

    const result = addAndroidMediaStoragePackage(
      source,
      "com.alghurobaa.podcast.dev.media",
    );

    expect(result).toContain(
      "import com.alghurobaa.podcast.dev.media.AndroidMediaStoragePackage",
    );
    expect(result).not.toContain(
      "import com.alghurobaa.podcast.media.AndroidMediaStoragePackage",
    );
    expect(result.match(/add\(AndroidMediaStoragePackage\(\)\)/g)).toHaveLength(
      1,
    );
  });

  test("fails prebuild when Expo's package-list anchor changes", () => {
    expect(() =>
      addAndroidMediaStoragePackage(
        "import com.facebook.react.ReactPackage\n\nreturn packages",
      ),
    ).toThrow("package-list anchor was not found");
  });

  test("fails prebuild when Expo's import anchor changes", () => {
    expect(() =>
      addAndroidMediaStoragePackage("PackageList(this).packages.apply {\n}"),
    ).toThrow("ReactPackage import anchor was not found");
  });
});

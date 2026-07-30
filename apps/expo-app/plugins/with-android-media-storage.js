const {
  withDangerousMod,
  withMainApplication,
} = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

function getAndroidModule(packageName) {
  return `package ${packageName}

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class AndroidMediaStorageModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AndroidMediaStorage"

  private fun resolveMediaApplicationId(applicationId: String): String =
    applicationId.removeSuffix(".dev").removeSuffix(".preview")

  @ReactMethod
  fun getMediaDirectory(mediaType: String, promise: Promise) {
    try {
      val allowedTypes = setOf("audio", "video", "image", "document")
      if (!allowedTypes.contains(mediaType)) {
        promise.reject("E_INVALID_MEDIA_TYPE", "Unsupported media folder: $mediaType")
        return
      }

      val appMediaRoot = reactContext.externalMediaDirs.firstOrNull()
      val androidMediaRoot = appMediaRoot?.parentFile
      if (androidMediaRoot == null) {
        promise.reject("E_MEDIA_STORAGE_UNAVAILABLE", "Android media storage is unavailable.")
        return
      }

      val sharedMediaRoot = File(
        androidMediaRoot,
        resolveMediaApplicationId(reactContext.packageName),
      )
      val directory = File(sharedMediaRoot, mediaType)
      if (!directory.exists() && !directory.mkdirs()) {
        promise.reject("E_CREATE_MEDIA_DIRECTORY", "Could not create the Android media folder.")
        return
      }

      promise.resolve(Uri.fromFile(directory).toString())
    } catch (error: Exception) {
      promise.reject("E_ANDROID_MEDIA_STORAGE", error.message, error)
    }
  }
}
`;
}

function getAndroidPackage(packageName) {
  return `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AndroidMediaStoragePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(AndroidMediaStorageModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<in Nothing, in Nothing>> = emptyList()
}
`;
}

function writeFileEnsured(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function addAndroidMediaStoragePackage(
  source,
  packageName = "com.alghurobaa.podcast.media",
) {
  const packageImport = `import ${packageName}.AndroidMediaStoragePackage`;
  let contents = source.replace(
    /^import [\w.]+\.media\.AndroidMediaStoragePackage\r?\n/gm,
    "",
  );

  if (!contents.includes(packageImport)) {
    const withImport = contents.replace(
      "import com.facebook.react.ReactPackage\n",
      `import com.facebook.react.ReactPackage\n${packageImport}\n`,
    );
    if (withImport === contents) {
      throw new Error(
        "Unable to register Android media storage: ReactPackage import anchor was not found.",
      );
    }
    contents = withImport;
  }

  if (!contents.includes("add(AndroidMediaStoragePackage())")) {
    const packageListAnchor = "PackageList(this).packages.apply {";
    const withRegistration = contents.replace(
      packageListAnchor,
      `${packageListAnchor}\n              add(AndroidMediaStoragePackage())`,
    );
    if (withRegistration === contents) {
      throw new Error(
        "Unable to register Android media storage: package-list anchor was not found.",
      );
    }
    contents = withRegistration;
  }

  return contents;
}

module.exports = function withAndroidMediaStorage(config) {
  const applicationId = config.android?.package;
  if (!applicationId) {
    throw new Error(
      "Unable to register Android media storage: Android package is not configured.",
    );
  }
  const packageName = `${applicationId}.media`;

  config = withDangerousMod(config, [
    "android",
    (modConfig) => {
      const root = modConfig.modRequest.platformProjectRoot;
      const sourceRoot = path.join(
        root,
        "app/src/main/java",
        ...packageName.split("."),
      );
      writeFileEnsured(
        path.join(sourceRoot, "AndroidMediaStorageModule.kt"),
        getAndroidModule(packageName),
      );
      writeFileEnsured(
        path.join(sourceRoot, "AndroidMediaStoragePackage.kt"),
        getAndroidPackage(packageName),
      );
      return modConfig;
    },
  ]);

  config = withMainApplication(config, (modConfig) => {
    modConfig.modResults.contents = addAndroidMediaStoragePackage(
      modConfig.modResults.contents,
      packageName,
    );
    return modConfig;
  });

  return config;
};

module.exports.addAndroidMediaStoragePackage = addAndroidMediaStoragePackage;

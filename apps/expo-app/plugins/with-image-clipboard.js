const { withAndroidManifest, withAppBuildGradle, withDangerousMod, withMainApplication } = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const ANDROID_MODULE = `package com.alghurobaa.podcast.clipboard

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class ImageClipboardModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ImageClipboard"

  @ReactMethod
  fun copyImage(fileUri: String, promise: Promise) {
    try {
      val uri = Uri.parse(fileUri)
      if (uri.scheme != "file" || uri.path.isNullOrBlank()) {
        promise.reject("E_INVALID_URI", "Image clipboard copy requires a local file URI.")
        return
      }

      val imageFile = File(uri.path!!)
      if (!imageFile.exists()) {
        promise.reject("E_FILE_MISSING", "Image file does not exist.")
        return
      }

      val contentUri = FileProvider.getUriForFile(
        reactContext,
        "\${reactContext.packageName}.imageclipboard.fileprovider",
        imageFile,
      )
      val clipboard =
        reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      clipboard.setPrimaryClip(ClipData.newUri(reactContext.contentResolver, "Image", contentUri))
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("E_COPY_IMAGE", error.message, error)
    }
  }
}
`;

const ANDROID_PACKAGE = `package com.alghurobaa.podcast.clipboard

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ImageClipboardPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(ImageClipboardModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<in Nothing, in Nothing>> = emptyList()
}
`;

const ANDROID_PATHS = `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
  <cache-path name="image_clipboard_cache" path="." />
</paths>
`;

const IOS_MODULE = `#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface ImageClipboard : NSObject <RCTBridgeModule>
@end

@implementation ImageClipboard

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(copyImage:(NSString *)fileUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = [NSURL URLWithString:fileUri];
  if (url == nil || !url.isFileURL) {
    reject(@"E_INVALID_URI", @"Image clipboard copy requires a local file URI.", nil);
    return;
  }

  NSData *data = [NSData dataWithContentsOfURL:url];
  UIImage *image = data ? [UIImage imageWithData:data] : nil;
  if (image == nil) {
    reject(@"E_INVALID_IMAGE", @"Could not read image data.", nil);
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    UIPasteboard.generalPasteboard.image = image;
    resolve(@YES);
  });
}

@end
`;

function writeFileEnsured(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function patchXcodeProject(projectPath) {
  if (!fs.existsSync(projectPath)) return;

  let contents = fs.readFileSync(projectPath, "utf8");
  if (!contents.includes("ImageClipboard.m in Sources")) {
    contents = contents.replace(
      "\t\t7AED7C7E6233C7121A5BF0EB /* libPods-AlGhurobaa.a in Frameworks */ = {isa = PBXBuildFile; fileRef = F51F9B86313005D6FBE6C754 /* libPods-AlGhurobaa.a */; };\n",
      "\t\t7AED7C7E6233C7121A5BF0EB /* libPods-AlGhurobaa.a in Frameworks */ = {isa = PBXBuildFile; fileRef = F51F9B86313005D6FBE6C754 /* libPods-AlGhurobaa.a */; };\n\t\tA1B2C3D4E5F60718293A4B5C /* ImageClipboard.m in Sources */ = {isa = PBXBuildFile; fileRef = A1B2C3D4E5F60718293A4B5B /* ImageClipboard.m */; };\n",
    );
    contents = contents.replace(
      "\t\tAA286B85B6C04FC6940260E9 /* SplashScreen.storyboard */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = file.storyboard; name = SplashScreen.storyboard; path = AlGhurobaa/SplashScreen.storyboard; sourceTree = \"<group>\"; };\n",
      "\t\tAA286B85B6C04FC6940260E9 /* SplashScreen.storyboard */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = file.storyboard; name = SplashScreen.storyboard; path = AlGhurobaa/SplashScreen.storyboard; sourceTree = \"<group>\"; };\n\t\tA1B2C3D4E5F60718293A4B5B /* ImageClipboard.m */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.c.objc; name = ImageClipboard.m; path = AlGhurobaa/ImageClipboard.m; sourceTree = \"<group>\"; };\n",
    );
    contents = contents.replace(
      "\t\t\t\tF11748412D0307B40044C1D9 /* AppDelegate.swift */,\n",
      "\t\t\t\tF11748412D0307B40044C1D9 /* AppDelegate.swift */,\n\t\t\t\tA1B2C3D4E5F60718293A4B5B /* ImageClipboard.m */,\n",
    );
    contents = contents.replace(
      "\t\t\t\t4BB10552E6E0FDDBB2BA25A2 /* ExpoModulesProvider.swift in Sources */,\n",
      "\t\t\t\t4BB10552E6E0FDDBB2BA25A2 /* ExpoModulesProvider.swift in Sources */,\n\t\t\t\tA1B2C3D4E5F60718293A4B5C /* ImageClipboard.m in Sources */,\n",
    );
    fs.writeFileSync(projectPath, contents);
  }
}

module.exports = function withImageClipboard(config) {
  config = withDangerousMod(config, [
    "android",
    (modConfig) => {
      const root = modConfig.modRequest.platformProjectRoot;
      writeFileEnsured(
        path.join(root, "app/src/main/java/com/alghurobaa/podcast/clipboard/ImageClipboardModule.kt"),
        ANDROID_MODULE,
      );
      writeFileEnsured(
        path.join(root, "app/src/main/java/com/alghurobaa/podcast/clipboard/ImageClipboardPackage.kt"),
        ANDROID_PACKAGE,
      );
      writeFileEnsured(
        path.join(root, "app/src/main/res/xml/image_clipboard_paths.xml"),
        ANDROID_PATHS,
      );
      return modConfig;
    },
  ]);

  config = withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes("ImageClipboardPackage")) {
      contents = contents.replace(
        "import com.facebook.react.defaults.DefaultReactNativeHost\n",
        "import com.facebook.react.defaults.DefaultReactNativeHost\nimport com.alghurobaa.podcast.clipboard.ImageClipboardPackage\n",
      );
      contents = contents.replace(
        "// add(MyReactNativePackage())",
        "add(ImageClipboardPackage())",
      );
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });

  config = withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) return modConfig;

    application.provider = application.provider ?? [];
    const providers = application.provider;
    const hasProvider = providers.some(
      (provider) =>
        provider.$?.["android:authorities"] ===
        "${applicationId}.imageclipboard.fileprovider",
    );
    if (!hasProvider) {
      providers.push({
        $: {
          "android:name": "androidx.core.content.FileProvider",
          "android:authorities": "${applicationId}.imageclipboard.fileprovider",
          "android:exported": "false",
          "android:grantUriPermissions": "true",
        },
        "meta-data": [
          {
            $: {
              "android:name": "android.support.FILE_PROVIDER_PATHS",
              "android:resource": "@xml/image_clipboard_paths",
            },
          },
        ],
      });
    }
    return modConfig;
  });

  config = withAppBuildGradle(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes("androidx.core:core")) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        'implementation("com.facebook.react:react-android")',
        'implementation("com.facebook.react:react-android")\n    implementation("androidx.core:core:1.13.1")',
      );
    }
    return modConfig;
  });

  config = withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const root = modConfig.modRequest.platformProjectRoot;
      writeFileEnsured(path.join(root, "AlGhurobaa/ImageClipboard.m"), IOS_MODULE);
      patchXcodeProject(path.join(root, "AlGhurobaa.xcodeproj/project.pbxproj"));
      return modConfig;
    },
  ]);

  return config;
};

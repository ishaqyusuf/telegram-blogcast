const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
// const { withUniwindConfig } = require("uniwind/metro");
/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
// config.resolver.unstable_enablePackageExports = true;

module.exports = withNativewind(config);
// module.exports = withUniwindConfig(config, {
//   cssEntryFile: "./global.css",
// });

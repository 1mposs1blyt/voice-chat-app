// const { getDefaultConfig } = require("expo/metro-config");
// const { withNativeWind } = require("nativewind/metro"); // Убрали -config

// const config = getDefaultConfig(__dirname);

// module.exports = withNativeWind(config, { input: "./global.css" });
const { getDefaultConfig } = require("expo/metro-config");
module.exports = getDefaultConfig(__dirname);

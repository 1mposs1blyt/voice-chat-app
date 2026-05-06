const { getDefaultConfig } = require("expo/metro-config");
// Пробуем импортировать из dist напрямую, если обычный путь не пашет
const { withNativeWind } = require("nativewind/dist/metro"); 

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });

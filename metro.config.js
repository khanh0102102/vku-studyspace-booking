const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro's web resolver selects Zustand's ESM build, which contains import.meta.
// Expo SDK 54 serves its web bundle as a classic script, so use Zustand's
// CommonJS entries instead. The CommonJS build is compatible with web, Android,
// and iOS and uses process.env.NODE_ENV rather than import.meta.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand' || moduleName.startsWith('zustand/')) {
    return context.resolveRequest(context, require.resolve(moduleName), platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

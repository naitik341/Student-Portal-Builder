const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The pnpm workspace contains many directories. Expo's default filesystem
// watcher can exhaust the workspace's inotify limit while crawling them.
config.resolver.useWatchman = true;

module.exports = config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.huahai.app',
  appName: '花海',
  webDir: 'dist/client',
  android: {
    allowMixedContent: true,
    backgroundColor: '#fff7fb',
  },
};

export default config;

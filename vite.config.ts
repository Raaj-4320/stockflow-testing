import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

const VERSION_TEMPLATE_PATH = path.resolve(__dirname, 'public/version.json');
const VERSION_OUTPUT_PATH = path.resolve(__dirname, 'dist/version.json');

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const buildId = process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString();
    const deployedAt = new Date().toISOString();
    const versionTargetUrl = process.env.VERSION_TARGET_URL || '';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        APP_BUILD_ID: JSON.stringify(buildId),
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      build: {
        rollupOptions: {
          plugins: [{
            name: 'write-version-json',
            closeBundle() {
              if (!fs.existsSync(VERSION_TEMPLATE_PATH) || !fs.existsSync(VERSION_OUTPUT_PATH)) return;
              const raw = fs.readFileSync(VERSION_TEMPLATE_PATH, 'utf8');
              const output = raw
                .replaceAll('__APP_BUILD_ID__', buildId)
                .replaceAll('__DEPLOYED_AT__', deployedAt)
                .replaceAll('__TARGET_URL__', versionTargetUrl);
              fs.writeFileSync(VERSION_OUTPUT_PATH, output, 'utf8');
            },
          }]
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

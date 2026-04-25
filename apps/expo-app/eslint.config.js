// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@acme/db',
              message: 'Expo must access database-backed data through the API.',
            },
            {
              name: '@acme/auth',
              message: 'Expo must use client-safe auth APIs, not server auth modules.',
            },
            {
              name: '@prisma/client',
              message: 'Expo must not import Prisma or generate database clients.',
            },
            {
              name: 'server-only',
              message: 'Expo must not import server-only modules.',
            },
          ],
          patterns: [
            {
              group: ['@acme/db/*', '@acme/auth/*', 'prisma', 'prisma/*'],
              message: 'Expo must access server resources through the API.',
            },
          ],
        },
      ],
    },
  },
]);

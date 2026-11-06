/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Scopes are optional; when present they must name an area of the repository.
    // `deps` and `deps-dev` are the scopes Dependabot uses for runtime and development updates.
    'scope-enum': [
      2,
      'always',
      [
        'collab',
        'deps',
        'deps-dev',
        'docs',
        'engine',
        'github',
        'protocol',
        'render-canvas',
        'repo',
        'research',
        'tooling',
        'web',
      ],
    ],
  },
};

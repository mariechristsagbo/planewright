/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,tsx,js,mjs,cjs}': ['eslint --max-warnings=0 --no-warn-ignored', 'prettier --write'],
  '*.{json,md,yml,yaml,css,html}': 'prettier --write',
};

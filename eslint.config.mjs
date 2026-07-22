export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', console: 'readonly', navigator: 'readonly',
        localStorage: 'readonly', sessionStorage: 'readonly', fetch: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
        FormData: 'readonly', Blob: 'readonly', File: 'readonly', FileReader: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly', Image: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        Intl: 'readonly', Promise: 'readonly', Map: 'readonly', Set: 'readonly',
        MutationObserver: 'readonly', ResizeObserver: 'readonly', IntersectionObserver: 'readonly',
        Chart: 'readonly', XLSX: 'readonly',
        history: 'readonly', location: 'readonly', crypto: 'readonly',
        performance: 'readonly', DOMParser: 'readonly', CustomEvent: 'readonly', Event: 'readonly',
        AbortController: 'readonly', WeakMap: 'readonly', structuredClone: 'readonly',
        getComputedStyle: 'readonly', matchMedia: 'readonly', requestIdleCallback: 'readonly',
        ClipboardItem: 'readonly', DataTransfer: 'readonly',
      },
    },
    rules: { 'no-undef': 'error' },
  },
];

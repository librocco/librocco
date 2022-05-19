const path = require('path')
const { defineConfig } = require('vite')

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'source/index.ts'),
      name: 'js-search',
      fileName: (format) => `js-search.${format}.js`
    },
  }
})

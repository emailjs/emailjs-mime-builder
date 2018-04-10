/* global require, module */

const path = require('path')

module.exports = {
  entry: {
    builder: './src/builder.js',
    utils: './src/utils.js'
  },
  output: {
    libraryTarget: 'commonjs2',
    libraryExport: 'default',
    path: path.join(__dirname, 'dist'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        /** babel */
        test: /\.js$/,
        exclude: /.*?-unit\.js/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['env', {
                modules: false
              }]
            ]
          }
        }
      }
    ]
  }
}

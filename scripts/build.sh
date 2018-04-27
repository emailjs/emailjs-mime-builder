#!/bin/bash

rm -rf "$PWD"/dist
node ./node_modules/webpack/bin/webpack.js --config webpack.config.js
git reset
git add "$PWD"/dist
git commit -m 'Updating dist files' -n

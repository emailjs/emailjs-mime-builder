'use strict';

require.config({
    baseUrl: '../src',
    paths: {
        'test': '../test',
        'chai': '../node_modules/chai/chai',
        'addressparser': '../node_modules/addressparser/src/addressparser',
        'mimetypes': '../node_modules/mimetypes/src/mimetypes',
        'mimefuncs': '../node_modules/mimefuncs/src/mimefuncs',
        'punycode': '../node_modules/punycode/punycode.min'
    }
});


mocha.setup('bdd');
require(['test/mailbuild-unit'], function() {
    (window.mochaPhantomJS || window.mocha).run();
});
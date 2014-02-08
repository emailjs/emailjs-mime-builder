/* global mailbuild: false, test: false, ok: false, equal: false */

test("Create mailbuild object", function(){
    "use strict";

    var mb = mailbuild();
    equal(typeof mb, "object");
});

test("Create child", function(){
    "use strict";

    var mb = mailbuild("multipart/mixed");

    var child = mb.createChild("multipart/mixed");
    ok(child.parentNode == mb);
    ok(child.rootNode == mb);

    var subchild1 = child.createChild("text/html");
    ok(subchild1.parentNode == child);
    ok(subchild1.rootNode == mb);

    var subchild2 = child.createChild("text/html");
    ok(subchild2.parentNode == child);
    ok(subchild2.rootNode == mb);
});

test("Append child", function(){
    "use strict";

    var mb = mailbuild("multipart/mixed");

    var child = mailbuild("text/plain");
    mb.appendChild(child);
    ok(child.parentNode == mb);
    ok(child.rootNode == mb);
    ok(mb._childNodes.length == 1);
    ok(mb._childNodes[0] == child);
});

test("Replace node", function(){
    "use strict";

    var mb = mailbuild(),
        child = mb.createChild("text/plain"),
        replacement = mailbuild("image/png");

    child.replace(replacement);
    equal(mb._childNodes.length, 1);
    ok(mb._childNodes[0] === replacement);
});

test("Remove node", function(){
    "use strict";

    var mb = mailbuild(),
        child = mb.createChild("text/plain");

    child.remove();
    equal(mb._childNodes.length, 0);
    ok(!child.parenNode);
});

test("Set header", function(){
    "use strict";

    var mb = mailbuild();

    mb.setHeader("key", "value");
    mb.setHeader("key", "value1");
    equal(mb.getHeader("Key"), "value1");

    mb.setHeader([{key:"key", value:"value2"}, {key: "key2", value:"value3"}]);
    equal(mb.getHeader("Key"), "value2");
    equal(mb.getHeader("Key2"), "value3");

    mb.setHeader({
        key: "value4",
        key2: "value5"
    });
    equal(mb.getHeader("Key"), "value4");
    equal(mb.getHeader("Key2"), "value5");

    equal(mb._headers.length, 2);
});

test("Add header", function(){
    "use strict";

    var mb = mailbuild();

    mb.addHeader("key", "value1");
    mb.addHeader("key", "value2");

    equal(mb._headers.length, 2);

    mb.addHeader([{key:"key", value:"value2"}, {key: "key2", value:"value3"}]);

    equal(mb._headers.length, 4);

    mb.addHeader({
        key: "value4",
        key2: "value5"
    });

    equal(mb._headers.length, 6);
    equal(mb.getHeader("Key"), "value1");
});

test("Normalize Header Key", function(){
    "use strict";

    var mb = mailbuild();

    equal(mb._normalizeHeaderKey("key"), "Key");
    equal(mb._normalizeHeaderKey("mime-vERSION"), "MIME-Version");
    equal(mb._normalizeHeaderKey("-a-long-name"), "-A-Long-Name");
});

test("Build Header Value", function(){
    "use strict";

    var mb = mailbuild();

    equal(mb._buildHeaderValue({value: "test"}), "test");
    equal(mb._buildHeaderValue({value: "test", params:{a:"b"}}), "test; a=b");
    equal(mb._buildHeaderValue({value: "test", params:{a:";"}}), "test; a=\";\"");
    equal(mb._buildHeaderValue({value: "test", params:{a:";\""}}), 'test; a=";\\""');
    equal(mb._buildHeaderValue({value: "test", params:{a:"b", c: "d"}}), "test; a=b; c=d");
});

test("Build root node", function(){
    "use strict";

    var mb = mailbuild("text/plain").
        setHeader({
            date: "12345",
            'message-id': "67890"
        }).
        setContent("Hello world!"),

        expected = "Content-Type: text/plain\r\n"+
                   "Date: 12345\r\n"+
                   "Message-Id: <67890>\r\n"+
                   "Content-Transfer-Encoding: 7bit\r\n"+
                   "MIME-Version: 1.0\r\n"+
                   "\r\n"+
                   "Hello world!";

    equal(mb.build(), expected);
});

test("Build child node", function(){
    "use strict";

    var mb = mailbuild("multipart/mixed"),
        childNode = mb.createChild("text/plain").
        setContent("Hello world!"),

        expected = "Content-Type: text/plain\r\n"+
                   "Content-Transfer-Encoding: 7bit\r\n"+
                   "\r\n"+
                   "Hello world!";

    equal(childNode.build(), expected);
});

test("Build multipart node", function(){
    "use strict";

    var mb = mailbuild("multipart/mixed", {baseBoundary: "test"}).
        setHeader({
            date: "12345",
            'message-id': "67890"
        }),

        expected = "Content-Type: multipart/mixed; boundary=\"----sinikael-?=_1-test\"\r\n"+
                   "Date: 12345\r\n"+
                   "Message-Id: <67890>\r\n"+
                   "MIME-Version: 1.0\r\n"+
                   "\r\n"+
                   "------sinikael-?=_1-test\r\n"+
                   "Content-Type: text/plain\r\n"+
                   "Content-Transfer-Encoding: 7bit\r\n"+
                   "\r\n"+
                   "Hello world!\r\n"+
                   "------sinikael-?=_1-test--\r\n";

    mb.createChild("text/plain").setContent("Hello world!");

    equal(mb.build(), expected);
});

test("Build root with generated headers", function(){
    "use strict";

    var msg = mailbuild("text/plain").build();

    ok(/^Date:\s/m.test(msg));
    ok(/^Message\-Id:\s</m.test(msg));
    ok(/^MIME-Version: 1.0$/m.test(msg));
});

test("setContent (string)", function(){
    "use strict";

    var msg = mailbuild("text/plain").
        setHeader({
            "Content-Transfer-Encoding": "quoted-printable"
        }).
        setContent("JÕGEVA").
        build(),

        expected = "J=C3=95GEVA";

    msg = msg.split("\r\n\r\n");
    msg.shift();
    msg = msg.join("\r\n\r\n");

    equal(msg, expected);
});

test("setContent (arraybuffer)", function(){
    "use strict";

    var arr = new Uint8Array(256),
        msg = mailbuild("text/plain").
        setHeader({
            "Content-Transfer-Encoding": "base64"
        }).
        setContent(arr),

        expected = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4\r\n"+
                   "OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3Bx\r\n"+
                   "cnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmq\r\n"+
                   "q6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj\r\n"+
                   "5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==";

    for(var i=0, len = arr.length; i<len; i++){
        arr[i] = i;
    }

    msg = msg.build().split("\r\n\r\n");
    msg.shift();
    msg = msg.join("\r\n\r\n");

    equal(msg, expected);
});

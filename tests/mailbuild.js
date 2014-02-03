
test("Create mailbuild object", function(){
    var mb = mailbuild();
    equal(typeof mb, "object");
});

test("Create child", function(){
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
    var mb = mailbuild("multipart/mixed");

    var child = mailbuild("text/plain");
    mb.appendChild(child);
    ok(child.parentNode == mb);
    ok(child.rootNode == mb);
    ok(mb.childNodes.length == 1);
    ok(mb.childNodes[0] == child);
});

test("Replace node", function(){
    var mb = mailbuild();
    var child = mb.createChild("text/plain");
    var replacement = mailbuild("image/png");
    child.replace(replacement);
    equal(mb.childNodes.length, 1);
    ok(mb.childNodes[0] === replacement);
});

test("Remove node", function(){
    var mb = mailbuild();
    var child = mb.createChild("text/plain");
    child.remove();
    equal(mb.childNodes.length, 0);
    ok(!child.parenNode);
});

test("Set header", function(){
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

    equal(mb.headers.length, 2)
});

test("Add header", function(){
    var mb = mailbuild();
    mb.addHeader("key", "value1");
    mb.addHeader("key", "value2");

    equal(mb.headers.length, 2);

    mb.addHeader([{key:"key", value:"value2"}, {key: "key2", value:"value3"}]);

    equal(mb.headers.length, 4);

    mb.addHeader({
        key: "value4",
        key2: "value5"
    });

    equal(mb.headers.length, 6);
    equal(mb.getHeader("Key"), "value1");
});

test("Normalize Header Key", function(){
    var mb = mailbuild();

    equal(mb.normalizeHeaderKey("key"), "Key");
    equal(mb.normalizeHeaderKey("mime-vERSION"), "MIME-Version");
    equal(mb.normalizeHeaderKey("-a-long-name"), "-A-Long-Name");

});


test("Build Header Value", function(){
    var mb = mailbuild();

    equal(mb.buildHeaderValue({value: "test"}), "test");
    equal(mb.buildHeaderValue({value: "test", params:{a:"b"}}), "test; a=b");
    equal(mb.buildHeaderValue({value: "test", params:{a:";"}}), "test; a=\";\"");
    equal(mb.buildHeaderValue({value: "test", params:{a:";\""}}), 'test; a=";\\""');
    equal(mb.buildHeaderValue({value: "test", params:{a:"b", c: "d"}}), "test; a=b; c=d");

});
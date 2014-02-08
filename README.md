# mailbuild

*mailbuild* is a low level rfc2822 message composer. Define your own mime tree, no magic included.

## Usage

### Volo

Install with [volo](http://volojs.org/):

```shell
volo add Kreata/mailbuild/master
```

**NB!** Requires [encoding.js](http://code.google.com/p/stringencoding/source/browse/encoding.js) and [encoding-indexes.js](http://code.google.com/p/stringencoding/source/browse/encoding-indexes.js) from [stringencoding](http://code.google.com/p/stringencoding/) project to be present on the page. This is a polyfill for TextEncoder/TextDecoder, not needed in latest Firefox and hopefully soon in Chrome either.

## API

Create a new `mailbuild` object with

```javascript
var builder = mailbuild(contentType [, options]);
```

Where

  * **contentType** - define the content type for created node. Can be left blank for attachments (content type derived from `filename` option if available)
  * **options** - an optional options object
    * **filename** - *String* filename for an attachment node
    * **baseBoundary** - *String* shared part of the unique multipart boundary (generated randomly if not set)

## Methods

The same methods apply to the root node created with `mailbuild()` and to any child nodes.

### createChild

Creates and appends a child node to the node object

```javascript
node.createChild(contentType, options)
```

The same arguments apply as with `mailbuild()`. Created node object is returned.

**Example**

```javascript
mailbuild("multipart/mixed").
    createChild("multipart/related").
        createChild("text/plain");
```

Generates the following mime tree:

```
multipart/mixed
  ↳ multipart/related
      ↳ text/plain
```

### appendChild

Appends an existing child node to the node object. Removes the node from an existing tree if needed.

```javascript
node.appendChild(childNode)
```

Where

  * **childNode** - child node to be appended

Method returns appended child node.

**Example**

```javascript
var childNode = mailbuild("text/plain"),
    rootNode = mailbuild("multipart/mixed");
rootnode.appendChild(childNode);
```

Generates the following mime tree:

```
multipart/mixed
  ↳ text/plain
```

## replace

Replaces current node with another node

```javascript
node.appendChild(replacementNode)
```

Where

  * **replacementNode** - node to replace the current node

Method returns replacement node.

**Example**

```javascript
var rootNode = mailbuild("multipart/mixed"),
    childNode = rootNode.createChild("text/plain");
childNode.replace(mailbuild("text/html"));
```

Generates the following mime tree:

```
multipart/mixed
  ↳ text/html
```

## remove

Removes current node from the mime tree. Does not make a lot of sense for a root node.

```javascript
node.remove();
```

Method returns removed node.

**Example**

```javascript

var rootNode = mailbuild("multipart/mixed"),
    childNode = rootNode.createChild("text/plain");
childNode.remove();
```

Generates the following mime tree:

```
multipart/mixed
```

## setHeader

Sets a header value. If the value for selected key exists, it is overwritten.

You can set multiple values as well by using `[{key:"", value:""}]` or
`{key: "value"}` structures as the first argument.

```javascript
node.setHeader(key, value);
```

Where

  * **key** - *String|Array|Object* Header key or a list of key value pairs
  * **value** - *String* Header value

Method returns current node.

**Example**

```javascript
mailbuild("text/plain").
    setHeader("content-disposition", "inline").
    setHeader({
        "content-transfer-encoding": "7bit"
    }).
    setHeader([
        {key: "message-id", value: "abcde"}
    ]);
```

Generates the following header:

```
Content-type: text/plain
Content-Disposition: inline
Content-Transfer-Encoding: 7bit
Message-Id: <abcde>
```

## addHeader

Adds a header value. If the value for selected key exists, the value is appended
as a new field and old one is not touched.

You can set multiple values as well by using `[{key:"", value:""}]` or
`{key: "value"}` structures as the first argument.

```javascript
node.addHeader(key, value);
```

Where

  * **key** - *String|Array|Object* Header key or a list of key value pairs
  * **value** - *String* Header value

Method returns current node.

**Example**

```javascript
mailbuild("text/plain").
    addHeader("X-Spam", "1").
    setHeader({
        "x-spam": "2"
    }).
    setHeader([
        {key: "x-spam", value: "3"}
    ]);
```

Generates the following header:

```
Content-type: text/plain
X-Spam: 1
X-Spam: 2
X-Spam: 3
```

## getHeader

Retrieves the first mathcing value of a selected key

```javascript
node.getHeader(key)
```

Where

  * **key** - *String* Key to search for

**Example**

```javascript
mailbuild("text/plain").getHeader("content-type"); // text/plain
```

## setContent

Sets body content for current node. If the value is a string, charset is added automatically
to Content-Type (if it is `text/*`). If the value is an ArrayBuffer, you need to specify the charset yourself.

```javascript
node.setContent(body)
```

Where

  * **body** - *String|ArrayBuffer* body content

**Example**

```javascript
mailbuild("text/plain").setContent("Hello world!");
```

## build

Builds the rfc2822 message from the current node. If this is a root node, mandatory header fields are set if missing (Date, Message-Id, MIME-Version)

```javascript
node.build()
```

Method returns the rfc2822 message as a string

**Example**

```javascript
mailbuild("text/plain").setContent("Hello world!").build();
```

Returns the following string:

```
Content-type: text/plain
Date: <current datetime>
Message-Id: <generated value>
MIME-Version: 1.0

Hello world!
```

## Tests

Download `mailbuild` source and install dependencies

```bash
git clone git@github.com:Kreata/mailbuild.git
cd mimetypes
volo install
```

Tests are handled by QUnit. Open [testrunner.html](tests/testrunner.html) to run the tests.

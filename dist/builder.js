'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _emailjsMimeCodec = require('emailjs-mime-codec');

var _emailjsMimeTypes = require('emailjs-mime-types');

var _utils = require('./utils');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Creates a new mime tree node. Assumes 'multipart/*' as the content type
 * if it is a branch, anything else counts as leaf. If rootNode is missing from
 * the options, assumes this is the root.
 *
 * @param {String} contentType Define the content type for the node. Can be left blank for attachments (derived from filename)
 * @param {Object} [options] optional options
 * @param {Object} [options.rootNode] root node for this tree
 * @param {Object} [options.parentNode] immediate parent for this node
 * @param {Object} [options.filename] filename for an attachment node
 * @param {String} [options.baseBoundary] shared part of the unique multipart boundary
 */
var MimeNode = function () {
  function MimeNode(contentType) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, MimeNode);

    this.nodeCounter = 0;

    /**
     * shared part of the unique multipart boundary
     */
    this.baseBoundary = options.baseBoundary || Date.now().toString() + Math.random();

    /**
     * If date headers is missing and current node is the root, this value is used instead
     */
    this.date = new Date();

    /**
     * Root node for current mime tree
     */
    this.rootNode = options.rootNode || this;

    /**
     * If filename is specified but contentType is not (probably an attachment)
     * detect the content type from filename extension
     */
    if (options.filename) {
      /**
       * Filename for this node. Useful with attachments
       */
      this.filename = options.filename;
      if (!contentType) {
        contentType = (0, _emailjsMimeTypes.detectMimeType)(this.filename.split('.').pop());
      }
    }

    /**
     * Immediate parent for this node (or undefined if not set)
     */
    this.parentNode = options.parentNode;

    /**
     * Used for generating unique boundaries (prepended to the shared base)
     */
    this._nodeId = ++this.rootNode.nodeCounter;

    /**
     * An array for possible child nodes
     */
    this._childNodes = [];

    /**
     * A list of header values for this node in the form of [{key:'', value:''}]
     */
    this._headers = [];

    /**
     * If content type is set (or derived from the filename) add it to headers
     */
    if (contentType) {
      this.setHeader('content-type', contentType);
    }

    /**
     * If true then BCC header is included in RFC2822 message.
     */
    this.includeBccInHeader = options.includeBccInHeader || false;
  }

  /**
   * Creates and appends a child node. Arguments provided are passed to MimeNode constructor
   *
   * @param {String} [contentType] Optional content type
   * @param {Object} [options] Optional options object
   * @return {Object} Created node object
   */


  _createClass(MimeNode, [{
    key: 'createChild',
    value: function createChild(contentType) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var node = new MimeNode(contentType, options);
      this.appendChild(node);
      return node;
    }

    /**
     * Appends an existing node to the mime tree. Removes the node from an existing
     * tree if needed
     *
     * @param {Object} childNode node to be appended
     * @return {Object} Appended node object
     */

  }, {
    key: 'appendChild',
    value: function appendChild(childNode) {
      if (childNode.rootNode !== this.rootNode) {
        childNode.rootNode = this.rootNode;
        childNode._nodeId = ++this.rootNode.nodeCounter;
      }

      childNode.parentNode = this;

      this._childNodes.push(childNode);
      return childNode;
    }

    /**
     * Replaces current node with another node
     *
     * @param {Object} node Replacement node
     * @return {Object} Replacement node
     */

  }, {
    key: 'replace',
    value: function replace(node) {
      var _this = this;

      if (node === this) {
        return this;
      }

      this.parentNode._childNodes.forEach(function (childNode, i) {
        if (childNode === _this) {
          node.rootNode = _this.rootNode;
          node.parentNode = _this.parentNode;
          node._nodeId = _this._nodeId;

          _this.rootNode = _this;
          _this.parentNode = undefined;

          node.parentNode._childNodes[i] = node;
        }
      });

      return node;
    }

    /**
     * Removes current node from the mime tree
     *
     * @return {Object} removed node
     */

  }, {
    key: 'remove',
    value: function remove() {
      if (!this.parentNode) {
        return this;
      }

      for (var i = this.parentNode._childNodes.length - 1; i >= 0; i--) {
        if (this.parentNode._childNodes[i] === this) {
          this.parentNode._childNodes.splice(i, 1);
          this.parentNode = undefined;
          this.rootNode = this;
          return this;
        }
      }
    }

    /**
     * Sets a header value. If the value for selected key exists, it is overwritten.
     * You can set multiple values as well by using [{key:'', value:''}] or
     * {key: 'value'} as the first argument.
     *
     * @param {String|Array|Object} key Header key or a list of key value pairs
     * @param {String} value Header value
     * @return {Object} current node
     */

  }, {
    key: 'setHeader',
    value: function setHeader(key, value) {
      var _this2 = this;

      var added = false;

      // Allow setting multiple headers at once
      if (!value && key && (typeof key === 'undefined' ? 'undefined' : _typeof(key)) === 'object') {
        if (key.key && key.value) {
          // allow {key:'content-type', value: 'text/plain'}
          this.setHeader(key.key, key.value);
        } else if (Array.isArray(key)) {
          // allow [{key:'content-type', value: 'text/plain'}]
          key.forEach(function (i) {
            return _this2.setHeader(i.key, i.value);
          });
        } else {
          // allow {'content-type': 'text/plain'}
          Object.keys(key).forEach(function (i) {
            return _this2.setHeader(i, key[i]);
          });
        }
        return this;
      }

      key = (0, _utils.normalizeHeaderKey)(key);

      var headerValue = { key: key, value: value

        // Check if the value exists and overwrite
      };for (var i = 0, len = this._headers.length; i < len; i++) {
        if (this._headers[i].key === key) {
          if (!added) {
            // replace the first match
            this._headers[i] = headerValue;
            added = true;
          } else {
            // remove following matches
            this._headers.splice(i, 1);
            i--;
            len--;
          }
        }
      }

      // match not found, append the value
      if (!added) {
        this._headers.push(headerValue);
      }

      return this;
    }

    /**
     * Adds a header value. If the value for selected key exists, the value is appended
     * as a new field and old one is not touched.
     * You can set multiple values as well by using [{key:'', value:''}] or
     * {key: 'value'} as the first argument.
     *
     * @param {String|Array|Object} key Header key or a list of key value pairs
     * @param {String} value Header value
     * @return {Object} current node
     */

  }, {
    key: 'addHeader',
    value: function addHeader(key, value) {
      var _this3 = this;

      // Allow setting multiple headers at once
      if (!value && key && (typeof key === 'undefined' ? 'undefined' : _typeof(key)) === 'object') {
        if (key.key && key.value) {
          // allow {key:'content-type', value: 'text/plain'}
          this.addHeader(key.key, key.value);
        } else if (Array.isArray(key)) {
          // allow [{key:'content-type', value: 'text/plain'}]
          key.forEach(function (i) {
            return _this3.addHeader(i.key, i.value);
          });
        } else {
          // allow {'content-type': 'text/plain'}
          Object.keys(key).forEach(function (i) {
            return _this3.addHeader(i, key[i]);
          });
        }
        return this;
      }

      this._headers.push({ key: (0, _utils.normalizeHeaderKey)(key), value: value });

      return this;
    }

    /**
     * Retrieves the first mathcing value of a selected key
     *
     * @param {String} key Key to search for
     * @retun {String} Value for the key
     */

  }, {
    key: 'getHeader',
    value: function getHeader(key) {
      key = (0, _utils.normalizeHeaderKey)(key);
      for (var i = 0, len = this._headers.length; i < len; i++) {
        if (this._headers[i].key === key) {
          return this._headers[i].value;
        }
      }
    }

    /**
     * Sets body content for current node. If the value is a string, charset is added automatically
     * to Content-Type (if it is text/*). If the value is a Typed Array, you need to specify
     * the charset yourself
     *
     * @param (String|Uint8Array) content Body content
     * @return {Object} current node
     */

  }, {
    key: 'setContent',
    value: function setContent(content) {
      this.content = content;
      return this;
    }

    /**
     * Builds the rfc2822 message from the current node. If this is a root node,
     * mandatory header fields are set if missing (Date, Message-Id, MIME-Version)
     *
     * @return {String} Compiled message
     */

  }, {
    key: 'build',
    value: function build() {
      var _this4 = this;

      var lines = [];
      var contentType = (this.getHeader('Content-Type') || '').toString().toLowerCase().trim();
      var transferEncoding = void 0;
      var flowed = void 0;

      if (this.content) {
        transferEncoding = (this.getHeader('Content-Transfer-Encoding') || '').toString().toLowerCase().trim();
        if (!transferEncoding || ['base64', 'quoted-printable'].indexOf(transferEncoding) < 0) {
          if (/^text\//i.test(contentType)) {
            // If there are no special symbols, no need to modify the text
            if ((0, _utils.isPlainText)(this.content)) {
              // If there are lines longer than 76 symbols/bytes, make the text 'flowed'
              if (/^.{77,}/m.test(this.content)) {
                flowed = true;
              }
              transferEncoding = '7bit';
            } else {
              transferEncoding = 'quoted-printable';
            }
          } else if (!/^multipart\//i.test(contentType)) {
            transferEncoding = transferEncoding || 'base64';
          }
        }

        if (transferEncoding) {
          this.setHeader('Content-Transfer-Encoding', transferEncoding);
        }
      }

      if (this.filename && !this.getHeader('Content-Disposition')) {
        this.setHeader('Content-Disposition', 'attachment');
      }

      this._headers.forEach(function (header) {
        var key = header.key;
        var value = header.value;
        var structured = void 0;

        switch (header.key) {
          case 'Content-Disposition':
            structured = (0, _emailjsMimeCodec.parseHeaderValue)(value);
            if (_this4.filename) {
              structured.params.filename = _this4.filename;
            }
            value = (0, _utils.buildHeaderValue)(structured);
            break;
          case 'Content-Type':
            structured = (0, _emailjsMimeCodec.parseHeaderValue)(value);

            _this4._addBoundary(structured);

            if (flowed) {
              structured.params.format = 'flowed';
            }
            if (String(structured.params.format).toLowerCase().trim() === 'flowed') {
              flowed = true;
            }

            if (structured.value.match(/^text\//) && typeof _this4.content === 'string' && /[\u0080-\uFFFF]/.test(_this4.content)) {
              structured.params.charset = 'utf-8';
            }

            value = (0, _utils.buildHeaderValue)(structured);
            break;
          case 'Bcc':
            if (_this4.includeBccInHeader === false) {
              // skip BCC values
              return;
            }
        }

        // skip empty lines
        value = (0, _utils.encodeHeaderValue)(key, value);
        if (!(value || '').toString().trim()) {
          return;
        }

        lines.push((0, _emailjsMimeCodec.foldLines)(key + ': ' + value));
      });

      // Ensure mandatory header fields
      if (this.rootNode === this) {
        if (!this.getHeader('Date')) {
          lines.push('Date: ' + this.date.toUTCString().replace(/GMT/, '+0000'));
        }
        // You really should define your own Message-Id field
        if (!this.getHeader('Message-Id')) {
          lines.push('Message-Id: <' +
          // crux to generate random strings like this:
          // "1401391905590-58aa8c32-d32a065c-c1a2aad2"
          [0, 0, 0].reduce(function (prev) {
            return prev + '-' + Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
          }, Date.now()) + '@' +
          // try to use the domain of the FROM address or fallback localhost
          (this.getEnvelope().from || 'localhost').split('@').pop() + '>');
        }
        if (!this.getHeader('MIME-Version')) {
          lines.push('MIME-Version: 1.0');
        }
      }
      lines.push('');

      if (this.content) {
        switch (transferEncoding) {
          case 'quoted-printable':
            lines.push((0, _emailjsMimeCodec.quotedPrintableEncode)(this.content));
            break;
          case 'base64':
            lines.push((0, _emailjsMimeCodec.base64Encode)(this.content, _typeof(this.content) === 'object' ? 'binary' : undefined));
            break;
          default:
            if (flowed) {
              // space stuffing http://tools.ietf.org/html/rfc3676#section-4.2
              lines.push((0, _emailjsMimeCodec.foldLines)(this.content.replace(/\r?\n/g, '\r\n').replace(/^( |From|>)/igm, ' $1'), 76, true));
            } else {
              lines.push(this.content.replace(/\r?\n/g, '\r\n'));
            }
        }
        if (this.multipart) {
          lines.push('');
        }
      }

      if (this.multipart) {
        this._childNodes.forEach(function (node) {
          lines.push('--' + _this4.boundary);
          lines.push(node.build());
        });
        lines.push('--' + this.boundary + '--');
        lines.push('');
      }

      return lines.join('\r\n');
    }

    /**
     * Generates and returns SMTP envelope with the sender address and a list of recipients addresses
     *
     * @return {Object} SMTP envelope in the form of {from: 'from@example.com', to: ['to@example.com']}
     */

  }, {
    key: 'getEnvelope',
    value: function getEnvelope() {
      var envelope = {
        from: false,
        to: []
      };
      this._headers.forEach(function (header) {
        var list = [];
        if (header.key === 'From' || !envelope.from && ['Reply-To', 'Sender'].indexOf(header.key) >= 0) {
          (0, _utils.convertAddresses)((0, _utils.parseAddresses)(header.value), list);
          if (list.length && list[0]) {
            envelope.from = list[0];
          }
        } else if (['To', 'Cc', 'Bcc'].indexOf(header.key) >= 0) {
          (0, _utils.convertAddresses)((0, _utils.parseAddresses)(header.value), envelope.to);
        }
      });

      return envelope;
    }

    /**
     * Checks if the content type is multipart and defines boundary if needed.
     * Doesn't return anything, modifies object argument instead.
     *
     * @param {Object} structured Parsed header value for 'Content-Type' key
     */

  }, {
    key: '_addBoundary',
    value: function _addBoundary(structured) {
      this.contentType = structured.value.trim().toLowerCase();

      this.multipart = this.contentType.split('/').reduce(function (prev, value) {
        return prev === 'multipart' ? value : false;
      });

      if (this.multipart) {
        this.boundary = structured.params.boundary = structured.params.boundary || this.boundary || (0, _utils.generateBoundary)(this._nodeId, this.rootNode.baseBoundary);
      } else {
        this.boundary = false;
      }
    }
  }]);

  return MimeNode;
}();

exports.default = MimeNode;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9idWlsZGVyLmpzIl0sIm5hbWVzIjpbIk1pbWVOb2RlIiwiY29udGVudFR5cGUiLCJvcHRpb25zIiwibm9kZUNvdW50ZXIiLCJiYXNlQm91bmRhcnkiLCJEYXRlIiwibm93IiwidG9TdHJpbmciLCJNYXRoIiwicmFuZG9tIiwiZGF0ZSIsInJvb3ROb2RlIiwiZmlsZW5hbWUiLCJzcGxpdCIsInBvcCIsInBhcmVudE5vZGUiLCJfbm9kZUlkIiwiX2NoaWxkTm9kZXMiLCJfaGVhZGVycyIsInNldEhlYWRlciIsImluY2x1ZGVCY2NJbkhlYWRlciIsIm5vZGUiLCJhcHBlbmRDaGlsZCIsImNoaWxkTm9kZSIsInB1c2giLCJmb3JFYWNoIiwiaSIsInVuZGVmaW5lZCIsImxlbmd0aCIsInNwbGljZSIsImtleSIsInZhbHVlIiwiYWRkZWQiLCJBcnJheSIsImlzQXJyYXkiLCJPYmplY3QiLCJrZXlzIiwiaGVhZGVyVmFsdWUiLCJsZW4iLCJhZGRIZWFkZXIiLCJjb250ZW50IiwibGluZXMiLCJnZXRIZWFkZXIiLCJ0b0xvd2VyQ2FzZSIsInRyaW0iLCJ0cmFuc2ZlckVuY29kaW5nIiwiZmxvd2VkIiwiaW5kZXhPZiIsInRlc3QiLCJoZWFkZXIiLCJzdHJ1Y3R1cmVkIiwicGFyYW1zIiwiX2FkZEJvdW5kYXJ5IiwiZm9ybWF0IiwiU3RyaW5nIiwibWF0Y2giLCJjaGFyc2V0IiwidG9VVENTdHJpbmciLCJyZXBsYWNlIiwicmVkdWNlIiwicHJldiIsImZsb29yIiwic3Vic3RyaW5nIiwiZ2V0RW52ZWxvcGUiLCJmcm9tIiwibXVsdGlwYXJ0IiwiYm91bmRhcnkiLCJidWlsZCIsImpvaW4iLCJlbnZlbG9wZSIsInRvIiwibGlzdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBOztBQU1BOztBQUNBOzs7O0FBVUE7Ozs7Ozs7Ozs7OztJQVlxQkEsUTtBQUNuQixvQkFBYUMsV0FBYixFQUF3QztBQUFBLFFBQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7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LCJmaWxlIjoiYnVpbGRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIGJhc2U2NEVuY29kZSxcbiAgcXVvdGVkUHJpbnRhYmxlRW5jb2RlLFxuICBmb2xkTGluZXMsXG4gIHBhcnNlSGVhZGVyVmFsdWVcbn0gZnJvbSAnZW1haWxqcy1taW1lLWNvZGVjJ1xuaW1wb3J0IHsgZGV0ZWN0TWltZVR5cGUgfSBmcm9tICdlbWFpbGpzLW1pbWUtdHlwZXMnXG5pbXBvcnQge1xuICBjb252ZXJ0QWRkcmVzc2VzLFxuICBwYXJzZUFkZHJlc3NlcyxcbiAgZW5jb2RlSGVhZGVyVmFsdWUsXG4gIG5vcm1hbGl6ZUhlYWRlcktleSxcbiAgZ2VuZXJhdGVCb3VuZGFyeSxcbiAgaXNQbGFpblRleHQsXG4gIGJ1aWxkSGVhZGVyVmFsdWVcbn0gZnJvbSAnLi91dGlscydcblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IG1pbWUgdHJlZSBub2RlLiBBc3N1bWVzICdtdWx0aXBhcnQvKicgYXMgdGhlIGNvbnRlbnQgdHlwZVxuICogaWYgaXQgaXMgYSBicmFuY2gsIGFueXRoaW5nIGVsc2UgY291bnRzIGFzIGxlYWYuIElmIHJvb3ROb2RlIGlzIG1pc3NpbmcgZnJvbVxuICogdGhlIG9wdGlvbnMsIGFzc3VtZXMgdGhpcyBpcyB0aGUgcm9vdC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gY29udGVudFR5cGUgRGVmaW5lIHRoZSBjb250ZW50IHR5cGUgZm9yIHRoZSBub2RlLiBDYW4gYmUgbGVmdCBibGFuayBmb3IgYXR0YWNobWVudHMgKGRlcml2ZWQgZnJvbSBmaWxlbmFtZSlcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gb3B0aW9uYWwgb3B0aW9uc1xuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnJvb3ROb2RlXSByb290IG5vZGUgZm9yIHRoaXMgdHJlZVxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnBhcmVudE5vZGVdIGltbWVkaWF0ZSBwYXJlbnQgZm9yIHRoaXMgbm9kZVxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLmZpbGVuYW1lXSBmaWxlbmFtZSBmb3IgYW4gYXR0YWNobWVudCBub2RlXG4gKiBAcGFyYW0ge1N0cmluZ30gW29wdGlvbnMuYmFzZUJvdW5kYXJ5XSBzaGFyZWQgcGFydCBvZiB0aGUgdW5pcXVlIG11bHRpcGFydCBib3VuZGFyeVxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNaW1lTm9kZSB7XG4gIGNvbnN0cnVjdG9yIChjb250ZW50VHlwZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5ub2RlQ291bnRlciA9IDBcblxuICAgIC8qKlxuICAgICAqIHNoYXJlZCBwYXJ0IG9mIHRoZSB1bmlxdWUgbXVsdGlwYXJ0IGJvdW5kYXJ5XG4gICAgICovXG4gICAgdGhpcy5iYXNlQm91bmRhcnkgPSBvcHRpb25zLmJhc2VCb3VuZGFyeSB8fCBEYXRlLm5vdygpLnRvU3RyaW5nKCkgKyBNYXRoLnJhbmRvbSgpXG5cbiAgICAvKipcbiAgICAgKiBJZiBkYXRlIGhlYWRlcnMgaXMgbWlzc2luZyBhbmQgY3VycmVudCBub2RlIGlzIHRoZSByb290LCB0aGlzIHZhbHVlIGlzIHVzZWQgaW5zdGVhZFxuICAgICAqL1xuICAgIHRoaXMuZGF0ZSA9IG5ldyBEYXRlKClcblxuICAgIC8qKlxuICAgICAqIFJvb3Qgbm9kZSBmb3IgY3VycmVudCBtaW1lIHRyZWVcbiAgICAgKi9cbiAgICB0aGlzLnJvb3ROb2RlID0gb3B0aW9ucy5yb290Tm9kZSB8fCB0aGlzXG5cbiAgICAvKipcbiAgICAgKiBJZiBmaWxlbmFtZSBpcyBzcGVjaWZpZWQgYnV0IGNvbnRlbnRUeXBlIGlzIG5vdCAocHJvYmFibHkgYW4gYXR0YWNobWVudClcbiAgICAgKiBkZXRlY3QgdGhlIGNvbnRlbnQgdHlwZSBmcm9tIGZpbGVuYW1lIGV4dGVuc2lvblxuICAgICAqL1xuICAgIGlmIChvcHRpb25zLmZpbGVuYW1lKSB7XG4gICAgICAvKipcbiAgICAgICAqIEZpbGVuYW1lIGZvciB0aGlzIG5vZGUuIFVzZWZ1bCB3aXRoIGF0dGFjaG1lbnRzXG4gICAgICAgKi9cbiAgICAgIHRoaXMuZmlsZW5hbWUgPSBvcHRpb25zLmZpbGVuYW1lXG4gICAgICBpZiAoIWNvbnRlbnRUeXBlKSB7XG4gICAgICAgIGNvbnRlbnRUeXBlID0gZGV0ZWN0TWltZVR5cGUodGhpcy5maWxlbmFtZS5zcGxpdCgnLicpLnBvcCgpKVxuICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEltbWVkaWF0ZSBwYXJlbnQgZm9yIHRoaXMgbm9kZSAob3IgdW5kZWZpbmVkIGlmIG5vdCBzZXQpXG4gICAgICovXG4gICAgdGhpcy5wYXJlbnROb2RlID0gb3B0aW9ucy5wYXJlbnROb2RlXG5cbiAgICAvKipcbiAgICAgKiBVc2VkIGZvciBnZW5lcmF0aW5nIHVuaXF1ZSBib3VuZGFyaWVzIChwcmVwZW5kZWQgdG8gdGhlIHNoYXJlZCBiYXNlKVxuICAgICAqL1xuICAgIHRoaXMuX25vZGVJZCA9ICsrdGhpcy5yb290Tm9kZS5ub2RlQ291bnRlclxuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgZm9yIHBvc3NpYmxlIGNoaWxkIG5vZGVzXG4gICAgICovXG4gICAgdGhpcy5fY2hpbGROb2RlcyA9IFtdXG5cbiAgICAvKipcbiAgICAgKiBBIGxpc3Qgb2YgaGVhZGVyIHZhbHVlcyBmb3IgdGhpcyBub2RlIGluIHRoZSBmb3JtIG9mIFt7a2V5OicnLCB2YWx1ZTonJ31dXG4gICAgICovXG4gICAgdGhpcy5faGVhZGVycyA9IFtdXG5cbiAgICAvKipcbiAgICAgKiBJZiBjb250ZW50IHR5cGUgaXMgc2V0IChvciBkZXJpdmVkIGZyb20gdGhlIGZpbGVuYW1lKSBhZGQgaXQgdG8gaGVhZGVyc1xuICAgICAqL1xuICAgIGlmIChjb250ZW50VHlwZSkge1xuICAgICAgdGhpcy5zZXRIZWFkZXIoJ2NvbnRlbnQtdHlwZScsIGNvbnRlbnRUeXBlKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlbiBCQ0MgaGVhZGVyIGlzIGluY2x1ZGVkIGluIFJGQzI4MjIgbWVzc2FnZS5cbiAgICAgKi9cbiAgICB0aGlzLmluY2x1ZGVCY2NJbkhlYWRlciA9IG9wdGlvbnMuaW5jbHVkZUJjY0luSGVhZGVyIHx8IGZhbHNlXG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbmQgYXBwZW5kcyBhIGNoaWxkIG5vZGUuIEFyZ3VtZW50cyBwcm92aWRlZCBhcmUgcGFzc2VkIHRvIE1pbWVOb2RlIGNvbnN0cnVjdG9yXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbY29udGVudFR5cGVdIE9wdGlvbmFsIGNvbnRlbnQgdHlwZVxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gQ3JlYXRlZCBub2RlIG9iamVjdFxuICAgKi9cbiAgY3JlYXRlQ2hpbGQgKGNvbnRlbnRUeXBlLCBvcHRpb25zID0ge30pIHtcbiAgICB2YXIgbm9kZSA9IG5ldyBNaW1lTm9kZShjb250ZW50VHlwZSwgb3B0aW9ucylcbiAgICB0aGlzLmFwcGVuZENoaWxkKG5vZGUpXG4gICAgcmV0dXJuIG5vZGVcbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBlbmRzIGFuIGV4aXN0aW5nIG5vZGUgdG8gdGhlIG1pbWUgdHJlZS4gUmVtb3ZlcyB0aGUgbm9kZSBmcm9tIGFuIGV4aXN0aW5nXG4gICAqIHRyZWUgaWYgbmVlZGVkXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjaGlsZE5vZGUgbm9kZSB0byBiZSBhcHBlbmRlZFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IEFwcGVuZGVkIG5vZGUgb2JqZWN0XG4gICAqL1xuICBhcHBlbmRDaGlsZCAoY2hpbGROb2RlKSB7XG4gICAgaWYgKGNoaWxkTm9kZS5yb290Tm9kZSAhPT0gdGhpcy5yb290Tm9kZSkge1xuICAgICAgY2hpbGROb2RlLnJvb3ROb2RlID0gdGhpcy5yb290Tm9kZVxuICAgICAgY2hpbGROb2RlLl9ub2RlSWQgPSArK3RoaXMucm9vdE5vZGUubm9kZUNvdW50ZXJcbiAgICB9XG5cbiAgICBjaGlsZE5vZGUucGFyZW50Tm9kZSA9IHRoaXNcblxuICAgIHRoaXMuX2NoaWxkTm9kZXMucHVzaChjaGlsZE5vZGUpXG4gICAgcmV0dXJuIGNoaWxkTm9kZVxuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxhY2VzIGN1cnJlbnQgbm9kZSB3aXRoIGFub3RoZXIgbm9kZVxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gbm9kZSBSZXBsYWNlbWVudCBub2RlXG4gICAqIEByZXR1cm4ge09iamVjdH0gUmVwbGFjZW1lbnQgbm9kZVxuICAgKi9cbiAgcmVwbGFjZSAobm9kZSkge1xuICAgIGlmIChub2RlID09PSB0aGlzKSB7XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIHRoaXMucGFyZW50Tm9kZS5fY2hpbGROb2Rlcy5mb3JFYWNoKChjaGlsZE5vZGUsIGkpID0+IHtcbiAgICAgIGlmIChjaGlsZE5vZGUgPT09IHRoaXMpIHtcbiAgICAgICAgbm9kZS5yb290Tm9kZSA9IHRoaXMucm9vdE5vZGVcbiAgICAgICAgbm9kZS5wYXJlbnROb2RlID0gdGhpcy5wYXJlbnROb2RlXG4gICAgICAgIG5vZGUuX25vZGVJZCA9IHRoaXMuX25vZGVJZFxuXG4gICAgICAgIHRoaXMucm9vdE5vZGUgPSB0aGlzXG4gICAgICAgIHRoaXMucGFyZW50Tm9kZSA9IHVuZGVmaW5lZFxuXG4gICAgICAgIG5vZGUucGFyZW50Tm9kZS5fY2hpbGROb2Rlc1tpXSA9IG5vZGVcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIG5vZGVcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGN1cnJlbnQgbm9kZSBmcm9tIHRoZSBtaW1lIHRyZWVcbiAgICpcbiAgICogQHJldHVybiB7T2JqZWN0fSByZW1vdmVkIG5vZGVcbiAgICovXG4gIHJlbW92ZSAoKSB7XG4gICAgaWYgKCF0aGlzLnBhcmVudE5vZGUpIHtcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGFyZW50Tm9kZS5fY2hpbGROb2Rlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKHRoaXMucGFyZW50Tm9kZS5fY2hpbGROb2Rlc1tpXSA9PT0gdGhpcykge1xuICAgICAgICB0aGlzLnBhcmVudE5vZGUuX2NoaWxkTm9kZXMuc3BsaWNlKGksIDEpXG4gICAgICAgIHRoaXMucGFyZW50Tm9kZSA9IHVuZGVmaW5lZFxuICAgICAgICB0aGlzLnJvb3ROb2RlID0gdGhpc1xuICAgICAgICByZXR1cm4gdGhpc1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIGEgaGVhZGVyIHZhbHVlLiBJZiB0aGUgdmFsdWUgZm9yIHNlbGVjdGVkIGtleSBleGlzdHMsIGl0IGlzIG92ZXJ3cml0dGVuLlxuICAgKiBZb3UgY2FuIHNldCBtdWx0aXBsZSB2YWx1ZXMgYXMgd2VsbCBieSB1c2luZyBbe2tleTonJywgdmFsdWU6Jyd9XSBvclxuICAgKiB7a2V5OiAndmFsdWUnfSBhcyB0aGUgZmlyc3QgYXJndW1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fE9iamVjdH0ga2V5IEhlYWRlciBrZXkgb3IgYSBsaXN0IG9mIGtleSB2YWx1ZSBwYWlyc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgSGVhZGVyIHZhbHVlXG4gICAqIEByZXR1cm4ge09iamVjdH0gY3VycmVudCBub2RlXG4gICAqL1xuICBzZXRIZWFkZXIgKGtleSwgdmFsdWUpIHtcbiAgICBsZXQgYWRkZWQgPSBmYWxzZVxuXG4gICAgLy8gQWxsb3cgc2V0dGluZyBtdWx0aXBsZSBoZWFkZXJzIGF0IG9uY2VcbiAgICBpZiAoIXZhbHVlICYmIGtleSAmJiB0eXBlb2Yga2V5ID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKGtleS5rZXkgJiYga2V5LnZhbHVlKSB7XG4gICAgICAgIC8vIGFsbG93IHtrZXk6J2NvbnRlbnQtdHlwZScsIHZhbHVlOiAndGV4dC9wbGFpbid9XG4gICAgICAgIHRoaXMuc2V0SGVhZGVyKGtleS5rZXksIGtleS52YWx1ZSlcbiAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShrZXkpKSB7XG4gICAgICAgIC8vIGFsbG93IFt7a2V5Oidjb250ZW50LXR5cGUnLCB2YWx1ZTogJ3RleHQvcGxhaW4nfV1cbiAgICAgICAga2V5LmZvckVhY2goaSA9PiB0aGlzLnNldEhlYWRlcihpLmtleSwgaS52YWx1ZSkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBhbGxvdyB7J2NvbnRlbnQtdHlwZSc6ICd0ZXh0L3BsYWluJ31cbiAgICAgICAgT2JqZWN0LmtleXMoa2V5KS5mb3JFYWNoKGkgPT4gdGhpcy5zZXRIZWFkZXIoaSwga2V5W2ldKSlcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAga2V5ID0gbm9ybWFsaXplSGVhZGVyS2V5KGtleSlcblxuICAgIGNvbnN0IGhlYWRlclZhbHVlID0geyBrZXksIHZhbHVlIH1cblxuICAgIC8vIENoZWNrIGlmIHRoZSB2YWx1ZSBleGlzdHMgYW5kIG92ZXJ3cml0ZVxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLl9oZWFkZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5faGVhZGVyc1tpXS5rZXkgPT09IGtleSkge1xuICAgICAgICBpZiAoIWFkZGVkKSB7XG4gICAgICAgICAgLy8gcmVwbGFjZSB0aGUgZmlyc3QgbWF0Y2hcbiAgICAgICAgICB0aGlzLl9oZWFkZXJzW2ldID0gaGVhZGVyVmFsdWVcbiAgICAgICAgICBhZGRlZCA9IHRydWVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyByZW1vdmUgZm9sbG93aW5nIG1hdGNoZXNcbiAgICAgICAgICB0aGlzLl9oZWFkZXJzLnNwbGljZShpLCAxKVxuICAgICAgICAgIGktLVxuICAgICAgICAgIGxlbi0tXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBtYXRjaCBub3QgZm91bmQsIGFwcGVuZCB0aGUgdmFsdWVcbiAgICBpZiAoIWFkZGVkKSB7XG4gICAgICB0aGlzLl9oZWFkZXJzLnB1c2goaGVhZGVyVmFsdWUpXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgaGVhZGVyIHZhbHVlLiBJZiB0aGUgdmFsdWUgZm9yIHNlbGVjdGVkIGtleSBleGlzdHMsIHRoZSB2YWx1ZSBpcyBhcHBlbmRlZFxuICAgKiBhcyBhIG5ldyBmaWVsZCBhbmQgb2xkIG9uZSBpcyBub3QgdG91Y2hlZC5cbiAgICogWW91IGNhbiBzZXQgbXVsdGlwbGUgdmFsdWVzIGFzIHdlbGwgYnkgdXNpbmcgW3trZXk6JycsIHZhbHVlOicnfV0gb3JcbiAgICoge2tleTogJ3ZhbHVlJ30gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxPYmplY3R9IGtleSBIZWFkZXIga2V5IG9yIGEgbGlzdCBvZiBrZXkgdmFsdWUgcGFpcnNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIEhlYWRlciB2YWx1ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9IGN1cnJlbnQgbm9kZVxuICAgKi9cbiAgYWRkSGVhZGVyIChrZXksIHZhbHVlKSB7XG4gICAgLy8gQWxsb3cgc2V0dGluZyBtdWx0aXBsZSBoZWFkZXJzIGF0IG9uY2VcbiAgICBpZiAoIXZhbHVlICYmIGtleSAmJiB0eXBlb2Yga2V5ID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKGtleS5rZXkgJiYga2V5LnZhbHVlKSB7XG4gICAgICAgIC8vIGFsbG93IHtrZXk6J2NvbnRlbnQtdHlwZScsIHZhbHVlOiAndGV4dC9wbGFpbid9XG4gICAgICAgIHRoaXMuYWRkSGVhZGVyKGtleS5rZXksIGtleS52YWx1ZSlcbiAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShrZXkpKSB7XG4gICAgICAgIC8vIGFsbG93IFt7a2V5Oidjb250ZW50LXR5cGUnLCB2YWx1ZTogJ3RleHQvcGxhaW4nfV1cbiAgICAgICAga2V5LmZvckVhY2goaSA9PiB0aGlzLmFkZEhlYWRlcihpLmtleSwgaS52YWx1ZSkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBhbGxvdyB7J2NvbnRlbnQtdHlwZSc6ICd0ZXh0L3BsYWluJ31cbiAgICAgICAgT2JqZWN0LmtleXMoa2V5KS5mb3JFYWNoKGkgPT4gdGhpcy5hZGRIZWFkZXIoaSwga2V5W2ldKSlcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgdGhpcy5faGVhZGVycy5wdXNoKHsga2V5OiBub3JtYWxpemVIZWFkZXJLZXkoa2V5KSwgdmFsdWUgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSBmaXJzdCBtYXRoY2luZyB2YWx1ZSBvZiBhIHNlbGVjdGVkIGtleVxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IEtleSB0byBzZWFyY2ggZm9yXG4gICAqIEByZXR1biB7U3RyaW5nfSBWYWx1ZSBmb3IgdGhlIGtleVxuICAgKi9cbiAgZ2V0SGVhZGVyIChrZXkpIHtcbiAgICBrZXkgPSBub3JtYWxpemVIZWFkZXJLZXkoa2V5KVxuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9oZWFkZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5faGVhZGVyc1tpXS5rZXkgPT09IGtleSkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGVhZGVyc1tpXS52YWx1ZVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIGJvZHkgY29udGVudCBmb3IgY3VycmVudCBub2RlLiBJZiB0aGUgdmFsdWUgaXMgYSBzdHJpbmcsIGNoYXJzZXQgaXMgYWRkZWQgYXV0b21hdGljYWxseVxuICAgKiB0byBDb250ZW50LVR5cGUgKGlmIGl0IGlzIHRleHQvKikuIElmIHRoZSB2YWx1ZSBpcyBhIFR5cGVkIEFycmF5LCB5b3UgbmVlZCB0byBzcGVjaWZ5XG4gICAqIHRoZSBjaGFyc2V0IHlvdXJzZWxmXG4gICAqXG4gICAqIEBwYXJhbSAoU3RyaW5nfFVpbnQ4QXJyYXkpIGNvbnRlbnQgQm9keSBjb250ZW50XG4gICAqIEByZXR1cm4ge09iamVjdH0gY3VycmVudCBub2RlXG4gICAqL1xuICBzZXRDb250ZW50IChjb250ZW50KSB7XG4gICAgdGhpcy5jb250ZW50ID0gY29udGVudFxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIHRoZSByZmMyODIyIG1lc3NhZ2UgZnJvbSB0aGUgY3VycmVudCBub2RlLiBJZiB0aGlzIGlzIGEgcm9vdCBub2RlLFxuICAgKiBtYW5kYXRvcnkgaGVhZGVyIGZpZWxkcyBhcmUgc2V0IGlmIG1pc3NpbmcgKERhdGUsIE1lc3NhZ2UtSWQsIE1JTUUtVmVyc2lvbilcbiAgICpcbiAgICogQHJldHVybiB7U3RyaW5nfSBDb21waWxlZCBtZXNzYWdlXG4gICAqL1xuICBidWlsZCAoKSB7XG4gICAgY29uc3QgbGluZXMgPSBbXVxuICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gKHRoaXMuZ2V0SGVhZGVyKCdDb250ZW50LVR5cGUnKSB8fCAnJykudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpLnRyaW0oKVxuICAgIGxldCB0cmFuc2ZlckVuY29kaW5nXG4gICAgbGV0IGZsb3dlZFxuXG4gICAgaWYgKHRoaXMuY29udGVudCkge1xuICAgICAgdHJhbnNmZXJFbmNvZGluZyA9ICh0aGlzLmdldEhlYWRlcignQ29udGVudC1UcmFuc2Zlci1FbmNvZGluZycpIHx8ICcnKS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkudHJpbSgpXG4gICAgICBpZiAoIXRyYW5zZmVyRW5jb2RpbmcgfHwgWydiYXNlNjQnLCAncXVvdGVkLXByaW50YWJsZSddLmluZGV4T2YodHJhbnNmZXJFbmNvZGluZykgPCAwKSB7XG4gICAgICAgIGlmICgvXnRleHRcXC8vaS50ZXN0KGNvbnRlbnRUeXBlKSkge1xuICAgICAgICAgIC8vIElmIHRoZXJlIGFyZSBubyBzcGVjaWFsIHN5bWJvbHMsIG5vIG5lZWQgdG8gbW9kaWZ5IHRoZSB0ZXh0XG4gICAgICAgICAgaWYgKGlzUGxhaW5UZXh0KHRoaXMuY29udGVudCkpIHtcbiAgICAgICAgICAgIC8vIElmIHRoZXJlIGFyZSBsaW5lcyBsb25nZXIgdGhhbiA3NiBzeW1ib2xzL2J5dGVzLCBtYWtlIHRoZSB0ZXh0ICdmbG93ZWQnXG4gICAgICAgICAgICBpZiAoL14uezc3LH0vbS50ZXN0KHRoaXMuY29udGVudCkpIHtcbiAgICAgICAgICAgICAgZmxvd2VkID0gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJhbnNmZXJFbmNvZGluZyA9ICc3Yml0J1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cmFuc2ZlckVuY29kaW5nID0gJ3F1b3RlZC1wcmludGFibGUnXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKCEvXm11bHRpcGFydFxcLy9pLnRlc3QoY29udGVudFR5cGUpKSB7XG4gICAgICAgICAgdHJhbnNmZXJFbmNvZGluZyA9IHRyYW5zZmVyRW5jb2RpbmcgfHwgJ2Jhc2U2NCdcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodHJhbnNmZXJFbmNvZGluZykge1xuICAgICAgICB0aGlzLnNldEhlYWRlcignQ29udGVudC1UcmFuc2Zlci1FbmNvZGluZycsIHRyYW5zZmVyRW5jb2RpbmcpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZmlsZW5hbWUgJiYgIXRoaXMuZ2V0SGVhZGVyKCdDb250ZW50LURpc3Bvc2l0aW9uJykpIHtcbiAgICAgIHRoaXMuc2V0SGVhZGVyKCdDb250ZW50LURpc3Bvc2l0aW9uJywgJ2F0dGFjaG1lbnQnKVxuICAgIH1cblxuICAgIHRoaXMuX2hlYWRlcnMuZm9yRWFjaChoZWFkZXIgPT4ge1xuICAgICAgY29uc3Qga2V5ID0gaGVhZGVyLmtleVxuICAgICAgbGV0IHZhbHVlID0gaGVhZGVyLnZhbHVlXG4gICAgICBsZXQgc3RydWN0dXJlZFxuXG4gICAgICBzd2l0Y2ggKGhlYWRlci5rZXkpIHtcbiAgICAgICAgY2FzZSAnQ29udGVudC1EaXNwb3NpdGlvbic6XG4gICAgICAgICAgc3RydWN0dXJlZCA9IHBhcnNlSGVhZGVyVmFsdWUodmFsdWUpXG4gICAgICAgICAgaWYgKHRoaXMuZmlsZW5hbWUpIHtcbiAgICAgICAgICAgIHN0cnVjdHVyZWQucGFyYW1zLmZpbGVuYW1lID0gdGhpcy5maWxlbmFtZVxuICAgICAgICAgIH1cbiAgICAgICAgICB2YWx1ZSA9IGJ1aWxkSGVhZGVyVmFsdWUoc3RydWN0dXJlZClcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdDb250ZW50LVR5cGUnOlxuICAgICAgICAgIHN0cnVjdHVyZWQgPSBwYXJzZUhlYWRlclZhbHVlKHZhbHVlKVxuXG4gICAgICAgICAgdGhpcy5fYWRkQm91bmRhcnkoc3RydWN0dXJlZClcblxuICAgICAgICAgIGlmIChmbG93ZWQpIHtcbiAgICAgICAgICAgIHN0cnVjdHVyZWQucGFyYW1zLmZvcm1hdCA9ICdmbG93ZWQnXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChTdHJpbmcoc3RydWN0dXJlZC5wYXJhbXMuZm9ybWF0KS50b0xvd2VyQ2FzZSgpLnRyaW0oKSA9PT0gJ2Zsb3dlZCcpIHtcbiAgICAgICAgICAgIGZsb3dlZCA9IHRydWVcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc3RydWN0dXJlZC52YWx1ZS5tYXRjaCgvXnRleHRcXC8vKSAmJiB0eXBlb2YgdGhpcy5jb250ZW50ID09PSAnc3RyaW5nJyAmJiAvW1xcdTAwODAtXFx1RkZGRl0vLnRlc3QodGhpcy5jb250ZW50KSkge1xuICAgICAgICAgICAgc3RydWN0dXJlZC5wYXJhbXMuY2hhcnNldCA9ICd1dGYtOCdcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YWx1ZSA9IGJ1aWxkSGVhZGVyVmFsdWUoc3RydWN0dXJlZClcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdCY2MnOlxuICAgICAgICAgIGlmICh0aGlzLmluY2x1ZGVCY2NJbkhlYWRlciA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIC8vIHNraXAgQkNDIHZhbHVlc1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBza2lwIGVtcHR5IGxpbmVzXG4gICAgICB2YWx1ZSA9IGVuY29kZUhlYWRlclZhbHVlKGtleSwgdmFsdWUpXG4gICAgICBpZiAoISh2YWx1ZSB8fCAnJykudG9TdHJpbmcoKS50cmltKCkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGxpbmVzLnB1c2goZm9sZExpbmVzKGtleSArICc6ICcgKyB2YWx1ZSkpXG4gICAgfSlcblxuICAgIC8vIEVuc3VyZSBtYW5kYXRvcnkgaGVhZGVyIGZpZWxkc1xuICAgIGlmICh0aGlzLnJvb3ROb2RlID09PSB0aGlzKSB7XG4gICAgICBpZiAoIXRoaXMuZ2V0SGVhZGVyKCdEYXRlJykpIHtcbiAgICAgICAgbGluZXMucHVzaCgnRGF0ZTogJyArIHRoaXMuZGF0ZS50b1VUQ1N0cmluZygpLnJlcGxhY2UoL0dNVC8sICcrMDAwMCcpKVxuICAgICAgfVxuICAgICAgLy8gWW91IHJlYWxseSBzaG91bGQgZGVmaW5lIHlvdXIgb3duIE1lc3NhZ2UtSWQgZmllbGRcbiAgICAgIGlmICghdGhpcy5nZXRIZWFkZXIoJ01lc3NhZ2UtSWQnKSkge1xuICAgICAgICBsaW5lcy5wdXNoKCdNZXNzYWdlLUlkOiA8JyArXG4gICAgICAgICAgLy8gY3J1eCB0byBnZW5lcmF0ZSByYW5kb20gc3RyaW5ncyBsaWtlIHRoaXM6XG4gICAgICAgICAgLy8gXCIxNDAxMzkxOTA1NTkwLTU4YWE4YzMyLWQzMmEwNjVjLWMxYTJhYWQyXCJcbiAgICAgICAgICBbMCwgMCwgMF0ucmVkdWNlKGZ1bmN0aW9uIChwcmV2KSB7XG4gICAgICAgICAgICByZXR1cm4gcHJldiArICctJyArIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDAwMDAwKVxuICAgICAgICAgICAgICAudG9TdHJpbmcoMTYpXG4gICAgICAgICAgICAgIC5zdWJzdHJpbmcoMSlcbiAgICAgICAgICB9LCBEYXRlLm5vdygpKSArXG4gICAgICAgICAgJ0AnICtcbiAgICAgICAgICAvLyB0cnkgdG8gdXNlIHRoZSBkb21haW4gb2YgdGhlIEZST00gYWRkcmVzcyBvciBmYWxsYmFjayBsb2NhbGhvc3RcbiAgICAgICAgICAodGhpcy5nZXRFbnZlbG9wZSgpLmZyb20gfHwgJ2xvY2FsaG9zdCcpLnNwbGl0KCdAJykucG9wKCkgK1xuICAgICAgICAgICc+JylcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5nZXRIZWFkZXIoJ01JTUUtVmVyc2lvbicpKSB7XG4gICAgICAgIGxpbmVzLnB1c2goJ01JTUUtVmVyc2lvbjogMS4wJylcbiAgICAgIH1cbiAgICB9XG4gICAgbGluZXMucHVzaCgnJylcblxuICAgIGlmICh0aGlzLmNvbnRlbnQpIHtcbiAgICAgIHN3aXRjaCAodHJhbnNmZXJFbmNvZGluZykge1xuICAgICAgICBjYXNlICdxdW90ZWQtcHJpbnRhYmxlJzpcbiAgICAgICAgICBsaW5lcy5wdXNoKHF1b3RlZFByaW50YWJsZUVuY29kZSh0aGlzLmNvbnRlbnQpKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgICAgbGluZXMucHVzaChiYXNlNjRFbmNvZGUodGhpcy5jb250ZW50LCB0eXBlb2YgdGhpcy5jb250ZW50ID09PSAnb2JqZWN0JyA/ICdiaW5hcnknIDogdW5kZWZpbmVkKSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmIChmbG93ZWQpIHtcbiAgICAgICAgICAgIC8vIHNwYWNlIHN0dWZmaW5nIGh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM2NzYjc2VjdGlvbi00LjJcbiAgICAgICAgICAgIGxpbmVzLnB1c2goZm9sZExpbmVzKHRoaXMuY29udGVudC5yZXBsYWNlKC9cXHI/XFxuL2csICdcXHJcXG4nKS5yZXBsYWNlKC9eKCB8RnJvbXw+KS9pZ20sICcgJDEnKSwgNzYsIHRydWUpKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaW5lcy5wdXNoKHRoaXMuY29udGVudC5yZXBsYWNlKC9cXHI/XFxuL2csICdcXHJcXG4nKSlcbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5tdWx0aXBhcnQpIHtcbiAgICAgICAgbGluZXMucHVzaCgnJylcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5tdWx0aXBhcnQpIHtcbiAgICAgIHRoaXMuX2NoaWxkTm9kZXMuZm9yRWFjaChub2RlID0+IHtcbiAgICAgICAgbGluZXMucHVzaCgnLS0nICsgdGhpcy5ib3VuZGFyeSlcbiAgICAgICAgbGluZXMucHVzaChub2RlLmJ1aWxkKCkpXG4gICAgICB9KVxuICAgICAgbGluZXMucHVzaCgnLS0nICsgdGhpcy5ib3VuZGFyeSArICctLScpXG4gICAgICBsaW5lcy5wdXNoKCcnKVxuICAgIH1cblxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXHJcXG4nKVxuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlcyBhbmQgcmV0dXJucyBTTVRQIGVudmVsb3BlIHdpdGggdGhlIHNlbmRlciBhZGRyZXNzIGFuZCBhIGxpc3Qgb2YgcmVjaXBpZW50cyBhZGRyZXNzZXNcbiAgICpcbiAgICogQHJldHVybiB7T2JqZWN0fSBTTVRQIGVudmVsb3BlIGluIHRoZSBmb3JtIG9mIHtmcm9tOiAnZnJvbUBleGFtcGxlLmNvbScsIHRvOiBbJ3RvQGV4YW1wbGUuY29tJ119XG4gICAqL1xuICBnZXRFbnZlbG9wZSAoKSB7XG4gICAgdmFyIGVudmVsb3BlID0ge1xuICAgICAgZnJvbTogZmFsc2UsXG4gICAgICB0bzogW11cbiAgICB9XG4gICAgdGhpcy5faGVhZGVycy5mb3JFYWNoKGhlYWRlciA9PiB7XG4gICAgICB2YXIgbGlzdCA9IFtdXG4gICAgICBpZiAoaGVhZGVyLmtleSA9PT0gJ0Zyb20nIHx8ICghZW52ZWxvcGUuZnJvbSAmJiBbJ1JlcGx5LVRvJywgJ1NlbmRlciddLmluZGV4T2YoaGVhZGVyLmtleSkgPj0gMCkpIHtcbiAgICAgICAgY29udmVydEFkZHJlc3NlcyhwYXJzZUFkZHJlc3NlcyhoZWFkZXIudmFsdWUpLCBsaXN0KVxuICAgICAgICBpZiAobGlzdC5sZW5ndGggJiYgbGlzdFswXSkge1xuICAgICAgICAgIGVudmVsb3BlLmZyb20gPSBsaXN0WzBdXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoWydUbycsICdDYycsICdCY2MnXS5pbmRleE9mKGhlYWRlci5rZXkpID49IDApIHtcbiAgICAgICAgY29udmVydEFkZHJlc3NlcyhwYXJzZUFkZHJlc3NlcyhoZWFkZXIudmFsdWUpLCBlbnZlbG9wZS50bylcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIGVudmVsb3BlXG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSBjb250ZW50IHR5cGUgaXMgbXVsdGlwYXJ0IGFuZCBkZWZpbmVzIGJvdW5kYXJ5IGlmIG5lZWRlZC5cbiAgICogRG9lc24ndCByZXR1cm4gYW55dGhpbmcsIG1vZGlmaWVzIG9iamVjdCBhcmd1bWVudCBpbnN0ZWFkLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gc3RydWN0dXJlZCBQYXJzZWQgaGVhZGVyIHZhbHVlIGZvciAnQ29udGVudC1UeXBlJyBrZXlcbiAgICovXG4gIF9hZGRCb3VuZGFyeSAoc3RydWN0dXJlZCkge1xuICAgIHRoaXMuY29udGVudFR5cGUgPSBzdHJ1Y3R1cmVkLnZhbHVlLnRyaW0oKS50b0xvd2VyQ2FzZSgpXG5cbiAgICB0aGlzLm11bHRpcGFydCA9IHRoaXMuY29udGVudFR5cGUuc3BsaXQoJy8nKS5yZWR1Y2UoZnVuY3Rpb24gKHByZXYsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gcHJldiA9PT0gJ211bHRpcGFydCcgPyB2YWx1ZSA6IGZhbHNlXG4gICAgfSlcblxuICAgIGlmICh0aGlzLm11bHRpcGFydCkge1xuICAgICAgdGhpcy5ib3VuZGFyeSA9IHN0cnVjdHVyZWQucGFyYW1zLmJvdW5kYXJ5ID0gc3RydWN0dXJlZC5wYXJhbXMuYm91bmRhcnkgfHwgdGhpcy5ib3VuZGFyeSB8fCBnZW5lcmF0ZUJvdW5kYXJ5KHRoaXMuX25vZGVJZCwgdGhpcy5yb290Tm9kZS5iYXNlQm91bmRhcnkpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYm91bmRhcnkgPSBmYWxzZVxuICAgIH1cbiAgfVxufVxuIl19
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
            // skip BCC values
            return;
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
            lines.push((0, _emailjsMimeCodec.base64Encode)(this.content, _typeof(this.content) === 'object' && 'binary' || false));
            break;
          default:
            if (flowed) {
              lines.push((0, _emailjsMimeCodec.foldLines)(this.content.replace(/\r?\n/g, '\r\n')
              // space stuffing http://tools.ietf.org/html/rfc3676#section-4.2
              .replace(/^( |From|>)/igm, ' $1'), 76, true));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9idWlsZGVyLmpzIl0sIm5hbWVzIjpbIk1pbWVOb2RlIiwiY29udGVudFR5cGUiLCJvcHRpb25zIiwibm9kZUNvdW50ZXIiLCJiYXNlQm91bmRhcnkiLCJEYXRlIiwibm93IiwidG9TdHJpbmciLCJNYXRoIiwicmFuZG9tIiwiZGF0ZSIsInJvb3ROb2RlIiwiZmlsZW5hbWUiLCJzcGxpdCIsInBvcCIsInBhcmVudE5vZGUiLCJfbm9kZUlkIiwiX2NoaWxkTm9kZXMiLCJfaGVhZGVycyIsInNldEhlYWRlciIsIm5vZGUiLCJhcHBlbmRDaGlsZCIsImNoaWxkTm9kZSIsInB1c2giLCJmb3JFYWNoIiwiaSIsInVuZGVmaW5lZCIsImxlbmd0aCIsInNwbGljZSIsImtleSIsInZhbHVlIiwiYWRkZWQiLCJBcnJheSIsImlzQXJyYXkiLCJPYmplY3QiLCJrZXlzIiwiaGVhZGVyVmFsdWUiLCJsZW4iLCJhZGRIZWFkZXIiLCJjb250ZW50IiwibGluZXMiLCJnZXRIZWFkZXIiLCJ0b0xvd2VyQ2FzZSIsInRyaW0iLCJ0cmFuc2ZlckVuY29kaW5nIiwiZmxvd2VkIiwiaW5kZXhPZiIsInRlc3QiLCJoZWFkZXIiLCJzdHJ1Y3R1cmVkIiwicGFyYW1zIiwiX2FkZEJvdW5kYXJ5IiwiZm9ybWF0IiwiU3RyaW5nIiwibWF0Y2giLCJjaGFyc2V0IiwidG9VVENTdHJpbmciLCJyZXBsYWNlIiwicmVkdWNlIiwicHJldiIsImZsb29yIiwic3Vic3RyaW5nIiwiZ2V0RW52ZWxvcGUiLCJmcm9tIiwibXVsdGlwYXJ0IiwiYm91bmRhcnkiLCJidWlsZCIsImpvaW4iLCJlbnZlbG9wZSIsInRvIiwibGlzdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBOztBQU1BOztBQUNBOzs7O0FBVUE7Ozs7Ozs7Ozs7OztJQVlxQkEsUTtBQUNuQixvQkFBYUMsV0FBYixFQUF3QztBQUFBLFFBQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7QUFDdEMsU0FBS0MsV0FBTCxHQUFt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Q0FBTCxDQUFoQjtBQUNEO0FBQ0YsU0FMRCxNQUtPLElBQUksQ0FBQyxJQUFELEVBQU8sSUFBUCxFQUFhLEtBQWIsRUFBb0J4QixPQUFwQixDQUE0QkUsT0FBT25CLEdBQW5DLEtBQTJDLENBQS9DLEVBQWtEO0FBQ3ZELHVDQUFpQiwyQkFBZW1CLE9BQU9sQixLQUF0QixDQUFqQixFQUErQ3NDLFNBQVNDLEVBQXhEO0FBQ0Q7QUFDRixPQVZEOztBQVlBLGFBQU9ELFFBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7O2lDQU1jbkIsVSxFQUFZO0FBQ3hCLFdBQUtoRCxXQUFMLEdBQW1CZ0QsV0FBV25CLEtBQVgsQ0FBaUJhLElBQWpCLEdBQXdCRCxXQUF4QixFQUFuQjs7QUFFQSxXQUFLc0IsU0FBTCxHQUFpQixLQUFLL0QsV0FBTCxDQUFpQlksS0FBakIsQ0FBdUIsR0FBdkIsRUFBNEI2QyxNQUE1QixDQUFtQyxVQUFVQyxJQUFWLEVBQWdCN0IsS0FBaEIsRUFBdUI7QUFDekUsZUFBTzZCLFNBQVMsV0FBVCxHQUF1QjdCLEtBQXZCLEdBQStCLEtBQXRDO0FBQ0QsT0FGZ0IsQ0FBakI7O0FBSUEsVUFBSSxLQUFLa0MsU0FBVCxFQUFvQjtBQUNsQixhQUFLQyxRQUFMLEdBQWdCaEIsV0FBV0MsTUFBWCxDQUFrQmUsUUFBbEIsR0FBNkJoQixXQUFXQyxNQUFYLENBQWtCZSxRQUFsQixJQUE4QixLQUFLQSxRQUFuQyxJQUErQyw2QkFBaUIsS0FBS2pELE9BQXRCLEVBQStCLEtBQUtMLFFBQUwsQ0FBY1AsWUFBN0MsQ0FBNUY7QUFDRCxPQUZELE1BRU87QUFDTCxhQUFLNkQsUUFBTCxHQUFnQixLQUFoQjtBQUNEO0FBQ0Y7Ozs7OztrQkEzYmtCakUsUSIsImZpbGUiOiJidWlsZGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgYmFzZTY0RW5jb2RlLFxuICBxdW90ZWRQcmludGFibGVFbmNvZGUsXG4gIGZvbGRMaW5lcyxcbiAgcGFyc2VIZWFkZXJWYWx1ZVxufSBmcm9tICdlbWFpbGpzLW1pbWUtY29kZWMnXG5pbXBvcnQgeyBkZXRlY3RNaW1lVHlwZSB9IGZyb20gJ2VtYWlsanMtbWltZS10eXBlcydcbmltcG9ydCB7XG4gIGNvbnZlcnRBZGRyZXNzZXMsXG4gIHBhcnNlQWRkcmVzc2VzLFxuICBlbmNvZGVIZWFkZXJWYWx1ZSxcbiAgbm9ybWFsaXplSGVhZGVyS2V5LFxuICBnZW5lcmF0ZUJvdW5kYXJ5LFxuICBpc1BsYWluVGV4dCxcbiAgYnVpbGRIZWFkZXJWYWx1ZVxufSBmcm9tICcuL3V0aWxzJ1xuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgbWltZSB0cmVlIG5vZGUuIEFzc3VtZXMgJ211bHRpcGFydC8qJyBhcyB0aGUgY29udGVudCB0eXBlXG4gKiBpZiBpdCBpcyBhIGJyYW5jaCwgYW55dGhpbmcgZWxzZSBjb3VudHMgYXMgbGVhZi4gSWYgcm9vdE5vZGUgaXMgbWlzc2luZyBmcm9tXG4gKiB0aGUgb3B0aW9ucywgYXNzdW1lcyB0aGlzIGlzIHRoZSByb290LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBjb250ZW50VHlwZSBEZWZpbmUgdGhlIGNvbnRlbnQgdHlwZSBmb3IgdGhlIG5vZGUuIENhbiBiZSBsZWZ0IGJsYW5rIGZvciBhdHRhY2htZW50cyAoZGVyaXZlZCBmcm9tIGZpbGVuYW1lKVxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBvcHRpb25hbCBvcHRpb25zXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucm9vdE5vZGVdIHJvb3Qgbm9kZSBmb3IgdGhpcyB0cmVlXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucGFyZW50Tm9kZV0gaW1tZWRpYXRlIHBhcmVudCBmb3IgdGhpcyBub2RlXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMuZmlsZW5hbWVdIGZpbGVuYW1lIGZvciBhbiBhdHRhY2htZW50IG5vZGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBbb3B0aW9ucy5iYXNlQm91bmRhcnldIHNoYXJlZCBwYXJ0IG9mIHRoZSB1bmlxdWUgbXVsdGlwYXJ0IGJvdW5kYXJ5XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1pbWVOb2RlIHtcbiAgY29uc3RydWN0b3IgKGNvbnRlbnRUeXBlLCBvcHRpb25zID0ge30pIHtcbiAgICB0aGlzLm5vZGVDb3VudGVyID0gMFxuXG4gICAgLyoqXG4gICAgICogc2hhcmVkIHBhcnQgb2YgdGhlIHVuaXF1ZSBtdWx0aXBhcnQgYm91bmRhcnlcbiAgICAgKi9cbiAgICB0aGlzLmJhc2VCb3VuZGFyeSA9IG9wdGlvbnMuYmFzZUJvdW5kYXJ5IHx8IERhdGUubm93KCkudG9TdHJpbmcoKSArIE1hdGgucmFuZG9tKClcblxuICAgIC8qKlxuICAgICAqIElmIGRhdGUgaGVhZGVycyBpcyBtaXNzaW5nIGFuZCBjdXJyZW50IG5vZGUgaXMgdGhlIHJvb3QsIHRoaXMgdmFsdWUgaXMgdXNlZCBpbnN0ZWFkXG4gICAgICovXG4gICAgdGhpcy5kYXRlID0gbmV3IERhdGUoKVxuXG4gICAgLyoqXG4gICAgICogUm9vdCBub2RlIGZvciBjdXJyZW50IG1pbWUgdHJlZVxuICAgICAqL1xuICAgIHRoaXMucm9vdE5vZGUgPSBvcHRpb25zLnJvb3ROb2RlIHx8IHRoaXNcblxuICAgIC8qKlxuICAgICAqIElmIGZpbGVuYW1lIGlzIHNwZWNpZmllZCBidXQgY29udGVudFR5cGUgaXMgbm90IChwcm9iYWJseSBhbiBhdHRhY2htZW50KVxuICAgICAqIGRldGVjdCB0aGUgY29udGVudCB0eXBlIGZyb20gZmlsZW5hbWUgZXh0ZW5zaW9uXG4gICAgICovXG4gICAgaWYgKG9wdGlvbnMuZmlsZW5hbWUpIHtcbiAgICAgIC8qKlxuICAgICAgICogRmlsZW5hbWUgZm9yIHRoaXMgbm9kZS4gVXNlZnVsIHdpdGggYXR0YWNobWVudHNcbiAgICAgICAqL1xuICAgICAgdGhpcy5maWxlbmFtZSA9IG9wdGlvbnMuZmlsZW5hbWVcbiAgICAgIGlmICghY29udGVudFR5cGUpIHtcbiAgICAgICAgY29udGVudFR5cGUgPSBkZXRlY3RNaW1lVHlwZSh0aGlzLmZpbGVuYW1lLnNwbGl0KCcuJykucG9wKCkpXG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW1tZWRpYXRlIHBhcmVudCBmb3IgdGhpcyBub2RlIChvciB1bmRlZmluZWQgaWYgbm90IHNldClcbiAgICAgKi9cbiAgICB0aGlzLnBhcmVudE5vZGUgPSBvcHRpb25zLnBhcmVudE5vZGVcblxuICAgIC8qKlxuICAgICAqIFVzZWQgZm9yIGdlbmVyYXRpbmcgdW5pcXVlIGJvdW5kYXJpZXMgKHByZXBlbmRlZCB0byB0aGUgc2hhcmVkIGJhc2UpXG4gICAgICovXG4gICAgdGhpcy5fbm9kZUlkID0gKyt0aGlzLnJvb3ROb2RlLm5vZGVDb3VudGVyXG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBmb3IgcG9zc2libGUgY2hpbGQgbm9kZXNcbiAgICAgKi9cbiAgICB0aGlzLl9jaGlsZE5vZGVzID0gW11cblxuICAgIC8qKlxuICAgICAqIEEgbGlzdCBvZiBoZWFkZXIgdmFsdWVzIGZvciB0aGlzIG5vZGUgaW4gdGhlIGZvcm0gb2YgW3trZXk6JycsIHZhbHVlOicnfV1cbiAgICAgKi9cbiAgICB0aGlzLl9oZWFkZXJzID0gW11cblxuICAgIC8qKlxuICAgICAqIElmIGNvbnRlbnQgdHlwZSBpcyBzZXQgKG9yIGRlcml2ZWQgZnJvbSB0aGUgZmlsZW5hbWUpIGFkZCBpdCB0byBoZWFkZXJzXG4gICAgICovXG4gICAgaWYgKGNvbnRlbnRUeXBlKSB7XG4gICAgICB0aGlzLnNldEhlYWRlcignY29udGVudC10eXBlJywgY29udGVudFR5cGUpXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW5kIGFwcGVuZHMgYSBjaGlsZCBub2RlLiBBcmd1bWVudHMgcHJvdmlkZWQgYXJlIHBhc3NlZCB0byBNaW1lTm9kZSBjb25zdHJ1Y3RvclxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gW2NvbnRlbnRUeXBlXSBPcHRpb25hbCBjb250ZW50IHR5cGVcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBPcHRpb25hbCBvcHRpb25zIG9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IENyZWF0ZWQgbm9kZSBvYmplY3RcbiAgICovXG4gIGNyZWF0ZUNoaWxkIChjb250ZW50VHlwZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgdmFyIG5vZGUgPSBuZXcgTWltZU5vZGUoY29udGVudFR5cGUsIG9wdGlvbnMpXG4gICAgdGhpcy5hcHBlbmRDaGlsZChub2RlKVxuICAgIHJldHVybiBub2RlXG4gIH1cblxuICAvKipcbiAgICogQXBwZW5kcyBhbiBleGlzdGluZyBub2RlIHRvIHRoZSBtaW1lIHRyZWUuIFJlbW92ZXMgdGhlIG5vZGUgZnJvbSBhbiBleGlzdGluZ1xuICAgKiB0cmVlIGlmIG5lZWRlZFxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGROb2RlIG5vZGUgdG8gYmUgYXBwZW5kZWRcbiAgICogQHJldHVybiB7T2JqZWN0fSBBcHBlbmRlZCBub2RlIG9iamVjdFxuICAgKi9cbiAgYXBwZW5kQ2hpbGQgKGNoaWxkTm9kZSkge1xuICAgIGlmIChjaGlsZE5vZGUucm9vdE5vZGUgIT09IHRoaXMucm9vdE5vZGUpIHtcbiAgICAgIGNoaWxkTm9kZS5yb290Tm9kZSA9IHRoaXMucm9vdE5vZGVcbiAgICAgIGNoaWxkTm9kZS5fbm9kZUlkID0gKyt0aGlzLnJvb3ROb2RlLm5vZGVDb3VudGVyXG4gICAgfVxuXG4gICAgY2hpbGROb2RlLnBhcmVudE5vZGUgPSB0aGlzXG5cbiAgICB0aGlzLl9jaGlsZE5vZGVzLnB1c2goY2hpbGROb2RlKVxuICAgIHJldHVybiBjaGlsZE5vZGVcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXBsYWNlcyBjdXJyZW50IG5vZGUgd2l0aCBhbm90aGVyIG5vZGVcbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IG5vZGUgUmVwbGFjZW1lbnQgbm9kZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9IFJlcGxhY2VtZW50IG5vZGVcbiAgICovXG4gIHJlcGxhY2UgKG5vZGUpIHtcbiAgICBpZiAobm9kZSA9PT0gdGhpcykge1xuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICB0aGlzLnBhcmVudE5vZGUuX2NoaWxkTm9kZXMuZm9yRWFjaCgoY2hpbGROb2RlLCBpKSA9PiB7XG4gICAgICBpZiAoY2hpbGROb2RlID09PSB0aGlzKSB7XG4gICAgICAgIG5vZGUucm9vdE5vZGUgPSB0aGlzLnJvb3ROb2RlXG4gICAgICAgIG5vZGUucGFyZW50Tm9kZSA9IHRoaXMucGFyZW50Tm9kZVxuICAgICAgICBub2RlLl9ub2RlSWQgPSB0aGlzLl9ub2RlSWRcblxuICAgICAgICB0aGlzLnJvb3ROb2RlID0gdGhpc1xuICAgICAgICB0aGlzLnBhcmVudE5vZGUgPSB1bmRlZmluZWRcblxuICAgICAgICBub2RlLnBhcmVudE5vZGUuX2NoaWxkTm9kZXNbaV0gPSBub2RlXG4gICAgICB9XG4gICAgfSlcblxuICAgIHJldHVybiBub2RlXG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyBjdXJyZW50IG5vZGUgZnJvbSB0aGUgbWltZSB0cmVlXG4gICAqXG4gICAqIEByZXR1cm4ge09iamVjdH0gcmVtb3ZlZCBub2RlXG4gICAqL1xuICByZW1vdmUgKCkge1xuICAgIGlmICghdGhpcy5wYXJlbnROb2RlKSB7XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSB0aGlzLnBhcmVudE5vZGUuX2NoaWxkTm9kZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmICh0aGlzLnBhcmVudE5vZGUuX2NoaWxkTm9kZXNbaV0gPT09IHRoaXMpIHtcbiAgICAgICAgdGhpcy5wYXJlbnROb2RlLl9jaGlsZE5vZGVzLnNwbGljZShpLCAxKVxuICAgICAgICB0aGlzLnBhcmVudE5vZGUgPSB1bmRlZmluZWRcbiAgICAgICAgdGhpcy5yb290Tm9kZSA9IHRoaXNcbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2V0cyBhIGhlYWRlciB2YWx1ZS4gSWYgdGhlIHZhbHVlIGZvciBzZWxlY3RlZCBrZXkgZXhpc3RzLCBpdCBpcyBvdmVyd3JpdHRlbi5cbiAgICogWW91IGNhbiBzZXQgbXVsdGlwbGUgdmFsdWVzIGFzIHdlbGwgYnkgdXNpbmcgW3trZXk6JycsIHZhbHVlOicnfV0gb3JcbiAgICoge2tleTogJ3ZhbHVlJ30gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxPYmplY3R9IGtleSBIZWFkZXIga2V5IG9yIGEgbGlzdCBvZiBrZXkgdmFsdWUgcGFpcnNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIEhlYWRlciB2YWx1ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9IGN1cnJlbnQgbm9kZVxuICAgKi9cbiAgc2V0SGVhZGVyIChrZXksIHZhbHVlKSB7XG4gICAgbGV0IGFkZGVkID0gZmFsc2VcblxuICAgIC8vIEFsbG93IHNldHRpbmcgbXVsdGlwbGUgaGVhZGVycyBhdCBvbmNlXG4gICAgaWYgKCF2YWx1ZSAmJiBrZXkgJiYgdHlwZW9mIGtleSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGlmIChrZXkua2V5ICYmIGtleS52YWx1ZSkge1xuICAgICAgICAvLyBhbGxvdyB7a2V5Oidjb250ZW50LXR5cGUnLCB2YWx1ZTogJ3RleHQvcGxhaW4nfVxuICAgICAgICB0aGlzLnNldEhlYWRlcihrZXkua2V5LCBrZXkudmFsdWUpXG4gICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoa2V5KSkge1xuICAgICAgICAvLyBhbGxvdyBbe2tleTonY29udGVudC10eXBlJywgdmFsdWU6ICd0ZXh0L3BsYWluJ31dXG4gICAgICAgIGtleS5mb3JFYWNoKGkgPT4gdGhpcy5zZXRIZWFkZXIoaS5rZXksIGkudmFsdWUpKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gYWxsb3cgeydjb250ZW50LXR5cGUnOiAndGV4dC9wbGFpbid9XG4gICAgICAgIE9iamVjdC5rZXlzKGtleSkuZm9yRWFjaChpID0+IHRoaXMuc2V0SGVhZGVyKGksIGtleVtpXSkpXG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIGtleSA9IG5vcm1hbGl6ZUhlYWRlcktleShrZXkpXG5cbiAgICBjb25zdCBoZWFkZXJWYWx1ZSA9IHsga2V5LCB2YWx1ZSB9XG5cbiAgICAvLyBDaGVjayBpZiB0aGUgdmFsdWUgZXhpc3RzIGFuZCBvdmVyd3JpdGVcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGhpcy5faGVhZGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgaWYgKHRoaXMuX2hlYWRlcnNbaV0ua2V5ID09PSBrZXkpIHtcbiAgICAgICAgaWYgKCFhZGRlZCkge1xuICAgICAgICAgIC8vIHJlcGxhY2UgdGhlIGZpcnN0IG1hdGNoXG4gICAgICAgICAgdGhpcy5faGVhZGVyc1tpXSA9IGhlYWRlclZhbHVlXG4gICAgICAgICAgYWRkZWQgPSB0cnVlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gcmVtb3ZlIGZvbGxvd2luZyBtYXRjaGVzXG4gICAgICAgICAgdGhpcy5faGVhZGVycy5zcGxpY2UoaSwgMSlcbiAgICAgICAgICBpLS1cbiAgICAgICAgICBsZW4tLVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gbWF0Y2ggbm90IGZvdW5kLCBhcHBlbmQgdGhlIHZhbHVlXG4gICAgaWYgKCFhZGRlZCkge1xuICAgICAgdGhpcy5faGVhZGVycy5wdXNoKGhlYWRlclZhbHVlKVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIGhlYWRlciB2YWx1ZS4gSWYgdGhlIHZhbHVlIGZvciBzZWxlY3RlZCBrZXkgZXhpc3RzLCB0aGUgdmFsdWUgaXMgYXBwZW5kZWRcbiAgICogYXMgYSBuZXcgZmllbGQgYW5kIG9sZCBvbmUgaXMgbm90IHRvdWNoZWQuXG4gICAqIFlvdSBjYW4gc2V0IG11bHRpcGxlIHZhbHVlcyBhcyB3ZWxsIGJ5IHVzaW5nIFt7a2V5OicnLCB2YWx1ZTonJ31dIG9yXG4gICAqIHtrZXk6ICd2YWx1ZSd9IGFzIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8QXJyYXl8T2JqZWN0fSBrZXkgSGVhZGVyIGtleSBvciBhIGxpc3Qgb2Yga2V5IHZhbHVlIHBhaXJzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBIZWFkZXIgdmFsdWVcbiAgICogQHJldHVybiB7T2JqZWN0fSBjdXJyZW50IG5vZGVcbiAgICovXG4gIGFkZEhlYWRlciAoa2V5LCB2YWx1ZSkge1xuICAgIC8vIEFsbG93IHNldHRpbmcgbXVsdGlwbGUgaGVhZGVycyBhdCBvbmNlXG4gICAgaWYgKCF2YWx1ZSAmJiBrZXkgJiYgdHlwZW9mIGtleSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGlmIChrZXkua2V5ICYmIGtleS52YWx1ZSkge1xuICAgICAgICAvLyBhbGxvdyB7a2V5Oidjb250ZW50LXR5cGUnLCB2YWx1ZTogJ3RleHQvcGxhaW4nfVxuICAgICAgICB0aGlzLmFkZEhlYWRlcihrZXkua2V5LCBrZXkudmFsdWUpXG4gICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoa2V5KSkge1xuICAgICAgICAvLyBhbGxvdyBbe2tleTonY29udGVudC10eXBlJywgdmFsdWU6ICd0ZXh0L3BsYWluJ31dXG4gICAgICAgIGtleS5mb3JFYWNoKGkgPT4gdGhpcy5hZGRIZWFkZXIoaS5rZXksIGkudmFsdWUpKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gYWxsb3cgeydjb250ZW50LXR5cGUnOiAndGV4dC9wbGFpbid9XG4gICAgICAgIE9iamVjdC5rZXlzKGtleSkuZm9yRWFjaChpID0+IHRoaXMuYWRkSGVhZGVyKGksIGtleVtpXSkpXG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIHRoaXMuX2hlYWRlcnMucHVzaCh7IGtleTogbm9ybWFsaXplSGVhZGVyS2V5KGtleSksIHZhbHVlIH0pXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgZmlyc3QgbWF0aGNpbmcgdmFsdWUgb2YgYSBzZWxlY3RlZCBrZXlcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBLZXkgdG8gc2VhcmNoIGZvclxuICAgKiBAcmV0dW4ge1N0cmluZ30gVmFsdWUgZm9yIHRoZSBrZXlcbiAgICovXG4gIGdldEhlYWRlciAoa2V5KSB7XG4gICAga2V5ID0gbm9ybWFsaXplSGVhZGVyS2V5KGtleSlcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5faGVhZGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgaWYgKHRoaXMuX2hlYWRlcnNbaV0ua2V5ID09PSBrZXkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hlYWRlcnNbaV0udmFsdWVcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2V0cyBib2R5IGNvbnRlbnQgZm9yIGN1cnJlbnQgbm9kZS4gSWYgdGhlIHZhbHVlIGlzIGEgc3RyaW5nLCBjaGFyc2V0IGlzIGFkZGVkIGF1dG9tYXRpY2FsbHlcbiAgICogdG8gQ29udGVudC1UeXBlIChpZiBpdCBpcyB0ZXh0LyopLiBJZiB0aGUgdmFsdWUgaXMgYSBUeXBlZCBBcnJheSwgeW91IG5lZWQgdG8gc3BlY2lmeVxuICAgKiB0aGUgY2hhcnNldCB5b3Vyc2VsZlxuICAgKlxuICAgKiBAcGFyYW0gKFN0cmluZ3xVaW50OEFycmF5KSBjb250ZW50IEJvZHkgY29udGVudFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IGN1cnJlbnQgbm9kZVxuICAgKi9cbiAgc2V0Q29udGVudCAoY29udGVudCkge1xuICAgIHRoaXMuY29udGVudCA9IGNvbnRlbnRcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyB0aGUgcmZjMjgyMiBtZXNzYWdlIGZyb20gdGhlIGN1cnJlbnQgbm9kZS4gSWYgdGhpcyBpcyBhIHJvb3Qgbm9kZSxcbiAgICogbWFuZGF0b3J5IGhlYWRlciBmaWVsZHMgYXJlIHNldCBpZiBtaXNzaW5nIChEYXRlLCBNZXNzYWdlLUlkLCBNSU1FLVZlcnNpb24pXG4gICAqXG4gICAqIEByZXR1cm4ge1N0cmluZ30gQ29tcGlsZWQgbWVzc2FnZVxuICAgKi9cbiAgYnVpbGQgKCkge1xuICAgIGNvbnN0IGxpbmVzID0gW11cbiAgICBjb25zdCBjb250ZW50VHlwZSA9ICh0aGlzLmdldEhlYWRlcignQ29udGVudC1UeXBlJykgfHwgJycpLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKS50cmltKClcbiAgICBsZXQgdHJhbnNmZXJFbmNvZGluZ1xuICAgIGxldCBmbG93ZWRcblxuICAgIGlmICh0aGlzLmNvbnRlbnQpIHtcbiAgICAgIHRyYW5zZmVyRW5jb2RpbmcgPSAodGhpcy5nZXRIZWFkZXIoJ0NvbnRlbnQtVHJhbnNmZXItRW5jb2RpbmcnKSB8fCAnJykudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpLnRyaW0oKVxuICAgICAgaWYgKCF0cmFuc2ZlckVuY29kaW5nIHx8IFsnYmFzZTY0JywgJ3F1b3RlZC1wcmludGFibGUnXS5pbmRleE9mKHRyYW5zZmVyRW5jb2RpbmcpIDwgMCkge1xuICAgICAgICBpZiAoL150ZXh0XFwvL2kudGVzdChjb250ZW50VHlwZSkpIHtcbiAgICAgICAgICAvLyBJZiB0aGVyZSBhcmUgbm8gc3BlY2lhbCBzeW1ib2xzLCBubyBuZWVkIHRvIG1vZGlmeSB0aGUgdGV4dFxuICAgICAgICAgIGlmIChpc1BsYWluVGV4dCh0aGlzLmNvbnRlbnQpKSB7XG4gICAgICAgICAgICAvLyBJZiB0aGVyZSBhcmUgbGluZXMgbG9uZ2VyIHRoYW4gNzYgc3ltYm9scy9ieXRlcywgbWFrZSB0aGUgdGV4dCAnZmxvd2VkJ1xuICAgICAgICAgICAgaWYgKC9eLns3Nyx9L20udGVzdCh0aGlzLmNvbnRlbnQpKSB7XG4gICAgICAgICAgICAgIGZsb3dlZCA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyYW5zZmVyRW5jb2RpbmcgPSAnN2JpdCdcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHJhbnNmZXJFbmNvZGluZyA9ICdxdW90ZWQtcHJpbnRhYmxlJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghL15tdWx0aXBhcnRcXC8vaS50ZXN0KGNvbnRlbnRUeXBlKSkge1xuICAgICAgICAgIHRyYW5zZmVyRW5jb2RpbmcgPSB0cmFuc2ZlckVuY29kaW5nIHx8ICdiYXNlNjQnXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHRyYW5zZmVyRW5jb2RpbmcpIHtcbiAgICAgICAgdGhpcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHJhbnNmZXItRW5jb2RpbmcnLCB0cmFuc2ZlckVuY29kaW5nKVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmZpbGVuYW1lICYmICF0aGlzLmdldEhlYWRlcignQ29udGVudC1EaXNwb3NpdGlvbicpKSB7XG4gICAgICB0aGlzLnNldEhlYWRlcignQ29udGVudC1EaXNwb3NpdGlvbicsICdhdHRhY2htZW50JylcbiAgICB9XG5cbiAgICB0aGlzLl9oZWFkZXJzLmZvckVhY2goaGVhZGVyID0+IHtcbiAgICAgIGNvbnN0IGtleSA9IGhlYWRlci5rZXlcbiAgICAgIGxldCB2YWx1ZSA9IGhlYWRlci52YWx1ZVxuICAgICAgbGV0IHN0cnVjdHVyZWRcblxuICAgICAgc3dpdGNoIChoZWFkZXIua2V5KSB7XG4gICAgICAgIGNhc2UgJ0NvbnRlbnQtRGlzcG9zaXRpb24nOlxuICAgICAgICAgIHN0cnVjdHVyZWQgPSBwYXJzZUhlYWRlclZhbHVlKHZhbHVlKVxuICAgICAgICAgIGlmICh0aGlzLmZpbGVuYW1lKSB7XG4gICAgICAgICAgICBzdHJ1Y3R1cmVkLnBhcmFtcy5maWxlbmFtZSA9IHRoaXMuZmlsZW5hbWVcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFsdWUgPSBidWlsZEhlYWRlclZhbHVlKHN0cnVjdHVyZWQpXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnQ29udGVudC1UeXBlJzpcbiAgICAgICAgICBzdHJ1Y3R1cmVkID0gcGFyc2VIZWFkZXJWYWx1ZSh2YWx1ZSlcblxuICAgICAgICAgIHRoaXMuX2FkZEJvdW5kYXJ5KHN0cnVjdHVyZWQpXG5cbiAgICAgICAgICBpZiAoZmxvd2VkKSB7XG4gICAgICAgICAgICBzdHJ1Y3R1cmVkLnBhcmFtcy5mb3JtYXQgPSAnZmxvd2VkJ1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoU3RyaW5nKHN0cnVjdHVyZWQucGFyYW1zLmZvcm1hdCkudG9Mb3dlckNhc2UoKS50cmltKCkgPT09ICdmbG93ZWQnKSB7XG4gICAgICAgICAgICBmbG93ZWQgPSB0cnVlXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHN0cnVjdHVyZWQudmFsdWUubWF0Y2goL150ZXh0XFwvLykgJiYgdHlwZW9mIHRoaXMuY29udGVudCA9PT0gJ3N0cmluZycgJiYgL1tcXHUwMDgwLVxcdUZGRkZdLy50ZXN0KHRoaXMuY29udGVudCkpIHtcbiAgICAgICAgICAgIHN0cnVjdHVyZWQucGFyYW1zLmNoYXJzZXQgPSAndXRmLTgnXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFsdWUgPSBidWlsZEhlYWRlclZhbHVlKHN0cnVjdHVyZWQpXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnQmNjJzpcbiAgICAgICAgICAvLyBza2lwIEJDQyB2YWx1ZXNcbiAgICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gc2tpcCBlbXB0eSBsaW5lc1xuICAgICAgdmFsdWUgPSBlbmNvZGVIZWFkZXJWYWx1ZShrZXksIHZhbHVlKVxuICAgICAgaWYgKCEodmFsdWUgfHwgJycpLnRvU3RyaW5nKCkudHJpbSgpKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBsaW5lcy5wdXNoKGZvbGRMaW5lcyhrZXkgKyAnOiAnICsgdmFsdWUpKVxuICAgIH0pXG5cbiAgICAvLyBFbnN1cmUgbWFuZGF0b3J5IGhlYWRlciBmaWVsZHNcbiAgICBpZiAodGhpcy5yb290Tm9kZSA9PT0gdGhpcykge1xuICAgICAgaWYgKCF0aGlzLmdldEhlYWRlcignRGF0ZScpKSB7XG4gICAgICAgIGxpbmVzLnB1c2goJ0RhdGU6ICcgKyB0aGlzLmRhdGUudG9VVENTdHJpbmcoKS5yZXBsYWNlKC9HTVQvLCAnKzAwMDAnKSlcbiAgICAgIH1cbiAgICAgIC8vIFlvdSByZWFsbHkgc2hvdWxkIGRlZmluZSB5b3VyIG93biBNZXNzYWdlLUlkIGZpZWxkXG4gICAgICBpZiAoIXRoaXMuZ2V0SGVhZGVyKCdNZXNzYWdlLUlkJykpIHtcbiAgICAgICAgbGluZXMucHVzaCgnTWVzc2FnZS1JZDogPCcgK1xuICAgICAgICAgIC8vIGNydXggdG8gZ2VuZXJhdGUgcmFuZG9tIHN0cmluZ3MgbGlrZSB0aGlzOlxuICAgICAgICAgIC8vIFwiMTQwMTM5MTkwNTU5MC01OGFhOGMzMi1kMzJhMDY1Yy1jMWEyYWFkMlwiXG4gICAgICAgICAgWzAsIDAsIDBdLnJlZHVjZShmdW5jdGlvbiAocHJldikge1xuICAgICAgICAgICAgcmV0dXJuIHByZXYgKyAnLScgKyBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwMDAwMClcbiAgICAgICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgICAuc3Vic3RyaW5nKDEpXG4gICAgICAgICAgfSwgRGF0ZS5ub3coKSkgK1xuICAgICAgICAgICdAJyArXG4gICAgICAgICAgLy8gdHJ5IHRvIHVzZSB0aGUgZG9tYWluIG9mIHRoZSBGUk9NIGFkZHJlc3Mgb3IgZmFsbGJhY2sgbG9jYWxob3N0XG4gICAgICAgICAgKHRoaXMuZ2V0RW52ZWxvcGUoKS5mcm9tIHx8ICdsb2NhbGhvc3QnKS5zcGxpdCgnQCcpLnBvcCgpICtcbiAgICAgICAgICAnPicpXG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuZ2V0SGVhZGVyKCdNSU1FLVZlcnNpb24nKSkge1xuICAgICAgICBsaW5lcy5wdXNoKCdNSU1FLVZlcnNpb246IDEuMCcpXG4gICAgICB9XG4gICAgfVxuICAgIGxpbmVzLnB1c2goJycpXG5cbiAgICBpZiAodGhpcy5jb250ZW50KSB7XG4gICAgICBzd2l0Y2ggKHRyYW5zZmVyRW5jb2RpbmcpIHtcbiAgICAgICAgY2FzZSAncXVvdGVkLXByaW50YWJsZSc6XG4gICAgICAgICAgbGluZXMucHVzaChxdW90ZWRQcmludGFibGVFbmNvZGUodGhpcy5jb250ZW50KSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAgIGxpbmVzLnB1c2goYmFzZTY0RW5jb2RlKHRoaXMuY29udGVudCwgKHR5cGVvZiB0aGlzLmNvbnRlbnQgPT09ICdvYmplY3QnICYmICdiaW5hcnknKSB8fCBmYWxzZSkpXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBpZiAoZmxvd2VkKSB7XG4gICAgICAgICAgICBsaW5lcy5wdXNoKGZvbGRMaW5lcyh0aGlzLmNvbnRlbnQucmVwbGFjZSgvXFxyP1xcbi9nLCAnXFxyXFxuJylcbiAgICAgICAgICAgICAgLy8gc3BhY2Ugc3R1ZmZpbmcgaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzY3NiNzZWN0aW9uLTQuMlxuICAgICAgICAgICAgICAucmVwbGFjZSgvXiggfEZyb218PikvaWdtLCAnICQxJyksXG4gICAgICAgICAgICAgIDc2LCB0cnVlKSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGluZXMucHVzaCh0aGlzLmNvbnRlbnQucmVwbGFjZSgvXFxyP1xcbi9nLCAnXFxyXFxuJykpXG4gICAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubXVsdGlwYXJ0KSB7XG4gICAgICAgIGxpbmVzLnB1c2goJycpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubXVsdGlwYXJ0KSB7XG4gICAgICB0aGlzLl9jaGlsZE5vZGVzLmZvckVhY2gobm9kZSA9PiB7XG4gICAgICAgIGxpbmVzLnB1c2goJy0tJyArIHRoaXMuYm91bmRhcnkpXG4gICAgICAgIGxpbmVzLnB1c2gobm9kZS5idWlsZCgpKVxuICAgICAgfSlcbiAgICAgIGxpbmVzLnB1c2goJy0tJyArIHRoaXMuYm91bmRhcnkgKyAnLS0nKVxuICAgICAgbGluZXMucHVzaCgnJylcbiAgICB9XG5cbiAgICByZXR1cm4gbGluZXMuam9pbignXFxyXFxuJylcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYW5kIHJldHVybnMgU01UUCBlbnZlbG9wZSB3aXRoIHRoZSBzZW5kZXIgYWRkcmVzcyBhbmQgYSBsaXN0IG9mIHJlY2lwaWVudHMgYWRkcmVzc2VzXG4gICAqXG4gICAqIEByZXR1cm4ge09iamVjdH0gU01UUCBlbnZlbG9wZSBpbiB0aGUgZm9ybSBvZiB7ZnJvbTogJ2Zyb21AZXhhbXBsZS5jb20nLCB0bzogWyd0b0BleGFtcGxlLmNvbSddfVxuICAgKi9cbiAgZ2V0RW52ZWxvcGUgKCkge1xuICAgIHZhciBlbnZlbG9wZSA9IHtcbiAgICAgIGZyb206IGZhbHNlLFxuICAgICAgdG86IFtdXG4gICAgfVxuICAgIHRoaXMuX2hlYWRlcnMuZm9yRWFjaChoZWFkZXIgPT4ge1xuICAgICAgdmFyIGxpc3QgPSBbXVxuICAgICAgaWYgKGhlYWRlci5rZXkgPT09ICdGcm9tJyB8fCAoIWVudmVsb3BlLmZyb20gJiYgWydSZXBseS1UbycsICdTZW5kZXInXS5pbmRleE9mKGhlYWRlci5rZXkpID49IDApKSB7XG4gICAgICAgIGNvbnZlcnRBZGRyZXNzZXMocGFyc2VBZGRyZXNzZXMoaGVhZGVyLnZhbHVlKSwgbGlzdClcbiAgICAgICAgaWYgKGxpc3QubGVuZ3RoICYmIGxpc3RbMF0pIHtcbiAgICAgICAgICBlbnZlbG9wZS5mcm9tID0gbGlzdFswXVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKFsnVG8nLCAnQ2MnLCAnQmNjJ10uaW5kZXhPZihoZWFkZXIua2V5KSA+PSAwKSB7XG4gICAgICAgIGNvbnZlcnRBZGRyZXNzZXMocGFyc2VBZGRyZXNzZXMoaGVhZGVyLnZhbHVlKSwgZW52ZWxvcGUudG8pXG4gICAgICB9XG4gICAgfSlcblxuICAgIHJldHVybiBlbnZlbG9wZVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGUgY29udGVudCB0eXBlIGlzIG11bHRpcGFydCBhbmQgZGVmaW5lcyBib3VuZGFyeSBpZiBuZWVkZWQuXG4gICAqIERvZXNuJ3QgcmV0dXJuIGFueXRoaW5nLCBtb2RpZmllcyBvYmplY3QgYXJndW1lbnQgaW5zdGVhZC5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IHN0cnVjdHVyZWQgUGFyc2VkIGhlYWRlciB2YWx1ZSBmb3IgJ0NvbnRlbnQtVHlwZScga2V5XG4gICAqL1xuICBfYWRkQm91bmRhcnkgKHN0cnVjdHVyZWQpIHtcbiAgICB0aGlzLmNvbnRlbnRUeXBlID0gc3RydWN0dXJlZC52YWx1ZS50cmltKCkudG9Mb3dlckNhc2UoKVxuXG4gICAgdGhpcy5tdWx0aXBhcnQgPSB0aGlzLmNvbnRlbnRUeXBlLnNwbGl0KCcvJykucmVkdWNlKGZ1bmN0aW9uIChwcmV2LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIHByZXYgPT09ICdtdWx0aXBhcnQnID8gdmFsdWUgOiBmYWxzZVxuICAgIH0pXG5cbiAgICBpZiAodGhpcy5tdWx0aXBhcnQpIHtcbiAgICAgIHRoaXMuYm91bmRhcnkgPSBzdHJ1Y3R1cmVkLnBhcmFtcy5ib3VuZGFyeSA9IHN0cnVjdHVyZWQucGFyYW1zLmJvdW5kYXJ5IHx8IHRoaXMuYm91bmRhcnkgfHwgZ2VuZXJhdGVCb3VuZGFyeSh0aGlzLl9ub2RlSWQsIHRoaXMucm9vdE5vZGUuYmFzZUJvdW5kYXJ5KVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmJvdW5kYXJ5ID0gZmFsc2VcbiAgICB9XG4gIH1cbn1cbiJdfQ==
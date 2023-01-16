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
     * Allow consumer to prevent library to re-encode content if it's already encoded
     */
    this.isEncoded = options.isEncoded || false;

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
     * Builds the rfc2822 message from the current node.
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

      lines.push('');

      if (this.content) {
        if (this.isEncoded) {
          lines.push(this.content.replace(/\r?\n/g, '\r\n'));
        } else {
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
        }
        if (this.multipart && this._childNodes.length > 0) {
          lines.push('');
        }
      }

      if (this.multipart && this._childNodes.length > 0) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9idWlsZGVyLmpzIl0sIm5hbWVzIjpbIk1pbWVOb2RlIiwiY29udGVudFR5cGUiLCJvcHRpb25zIiwibm9kZUNvdW50ZXIiLCJiYXNlQm91bmRhcnkiLCJEYXRlIiwibm93IiwidG9TdHJpbmciLCJNYXRoIiwicmFuZG9tIiwiZGF0ZSIsImlzRW5jb2RlZCIsInJvb3ROb2RlIiwiZmlsZW5hbWUiLCJzcGxpdCIsInBvcCIsInBhcmVudE5vZGUiLCJfbm9kZUlkIiwiX2NoaWxkTm9kZXMiLCJfaGVhZGVycyIsInNldEhlYWRlciIsImluY2x1ZGVCY2NJbkhlYWRlciIsIm5vZGUiLCJhcHBlbmRDaGlsZCIsImNoaWxkTm9kZSIsInB1c2giLCJmb3JFYWNoIiwiaSIsInVuZGVmaW5lZCIsImxlbmd0aCIsInNwbGljZSIsImtleSIsInZhbHVlIiwiYWRkZWQiLCJBcnJheSIsImlzQXJyYXkiLCJPYmplY3QiLCJrZXlzIiwiaGVhZGVyVmFsdWUiLCJsZW4iLCJhZGRIZWFkZXIiLCJjb250ZW50IiwibGluZXMiLCJnZXRIZWFkZXIiLCJ0b0xvd2VyQ2FzZSIsInRyaW0iLCJ0cmFuc2ZlckVuY29kaW5nIiwiZmxvd2VkIiwiaW5kZXhPZiIsInRlc3QiLCJoZWFkZXIiLCJzdHJ1Y3R1cmVkIiwicGFyYW1zIiwiX2FkZEJvdW5kYXJ5IiwiZm9ybWF0IiwiU3RyaW5nIiwibWF0Y2giLCJjaGFyc2V0IiwicmVwbGFjZSIsIm11bHRpcGFydCIsImJvdW5kYXJ5IiwiYnVpbGQiLCJqb2luIiwiZW52ZWxvcGUiLCJmcm9tIiwidG8iLCJsaXN0IiwicmVkdWNlIiwicHJldiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBOztBQU1BOztBQUNBOzs7O0FBVUE7Ozs7Ozs7Ozs7OztJQVlxQkEsUTtBQUNuQixvQkFBYUMsV0FBYixFQUF3QztBQUFBLFFBQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7QUFDdEMsU0FBS0MsV0FBTCxHQUFtQixDQUFuQjs7QUFFQTs7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dUIsR0FBdkIsRUFBNEJxRCxNQUE1QixDQUFtQyxVQUFVQyxJQUFWLEVBQWdCcEMsS0FBaEIsRUFBdUI7QUFDekUsZUFBT29DLFNBQVMsV0FBVCxHQUF1QnBDLEtBQXZCLEdBQStCLEtBQXRDO0FBQ0QsT0FGZ0IsQ0FBakI7O0FBSUEsVUFBSSxLQUFLMkIsU0FBVCxFQUFvQjtBQUNsQixhQUFLQyxRQUFMLEdBQWdCVCxXQUFXQyxNQUFYLENBQWtCUSxRQUFsQixHQUE2QlQsV0FBV0MsTUFBWCxDQUFrQlEsUUFBbEIsSUFBOEIsS0FBS0EsUUFBbkMsSUFBK0MsNkJBQWlCLEtBQUszQyxPQUF0QixFQUErQixLQUFLTCxRQUFMLENBQWNSLFlBQTdDLENBQTVGO0FBQ0QsT0FGRCxNQUVPO0FBQ0wsYUFBS3dELFFBQUwsR0FBZ0IsS0FBaEI7QUFDRDtBQUNGOzs7Ozs7a0JBaGJrQjVELFEiLCJmaWxlIjoiYnVpbGRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIGJhc2U2NEVuY29kZSxcbiAgcXVvdGVkUHJpbnRhYmxlRW5jb2RlLFxuICBmb2xkTGluZXMsXG4gIHBhcnNlSGVhZGVyVmFsdWVcbn0gZnJvbSAnZW1haWxqcy1taW1lLWNvZGVjJ1xuaW1wb3J0IHsgZGV0ZWN0TWltZVR5cGUgfSBmcm9tICdlbWFpbGpzLW1pbWUtdHlwZXMnXG5pbXBvcnQge1xuICBjb252ZXJ0QWRkcmVzc2VzLFxuICBwYXJzZUFkZHJlc3NlcyxcbiAgZW5jb2RlSGVhZGVyVmFsdWUsXG4gIG5vcm1hbGl6ZUhlYWRlcktleSxcbiAgZ2VuZXJhdGVCb3VuZGFyeSxcbiAgaXNQbGFpblRleHQsXG4gIGJ1aWxkSGVhZGVyVmFsdWVcbn0gZnJvbSAnLi91dGlscydcblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IG1pbWUgdHJlZSBub2RlLiBBc3N1bWVzICdtdWx0aXBhcnQvKicgYXMgdGhlIGNvbnRlbnQgdHlwZVxuICogaWYgaXQgaXMgYSBicmFuY2gsIGFueXRoaW5nIGVsc2UgY291bnRzIGFzIGxlYWYuIElmIHJvb3ROb2RlIGlzIG1pc3NpbmcgZnJvbVxuICogdGhlIG9wdGlvbnMsIGFzc3VtZXMgdGhpcyBpcyB0aGUgcm9vdC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gY29udGVudFR5cGUgRGVmaW5lIHRoZSBjb250ZW50IHR5cGUgZm9yIHRoZSBub2RlLiBDYW4gYmUgbGVmdCBibGFuayBmb3IgYXR0YWNobWVudHMgKGRlcml2ZWQgZnJvbSBmaWxlbmFtZSlcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gb3B0aW9uYWwgb3B0aW9uc1xuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnJvb3ROb2RlXSByb290IG5vZGUgZm9yIHRoaXMgdHJlZVxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnBhcmVudE5vZGVdIGltbWVkaWF0ZSBwYXJlbnQgZm9yIHRoaXMgbm9kZVxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLmZpbGVuYW1lXSBmaWxlbmFtZSBmb3IgYW4gYXR0YWNobWVudCBub2RlXG4gKiBAcGFyYW0ge1N0cmluZ30gW29wdGlvbnMuYmFzZUJvdW5kYXJ5XSBzaGFyZWQgcGFydCBvZiB0aGUgdW5pcXVlIG11bHRpcGFydCBib3VuZGFyeVxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNaW1lTm9kZSB7XG4gIGNvbnN0cnVjdG9yIChjb250ZW50VHlwZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5ub2RlQ291bnRlciA9IDBcblxuICAgIC8qKlxuICAgICAqIHNoYXJlZCBwYXJ0IG9mIHRoZSB1bmlxdWUgbXVsdGlwYXJ0IGJvdW5kYXJ5XG4gICAgICovXG4gICAgdGhpcy5iYXNlQm91bmRhcnkgPSBvcHRpb25zLmJhc2VCb3VuZGFyeSB8fCBEYXRlLm5vdygpLnRvU3RyaW5nKCkgKyBNYXRoLnJhbmRvbSgpXG5cbiAgICAvKipcbiAgICAgKiBJZiBkYXRlIGhlYWRlcnMgaXMgbWlzc2luZyBhbmQgY3VycmVudCBub2RlIGlzIHRoZSByb290LCB0aGlzIHZhbHVlIGlzIHVzZWQgaW5zdGVhZFxuICAgICAqL1xuICAgIHRoaXMuZGF0ZSA9IG5ldyBEYXRlKClcblxuICAgIC8qKlxuICAgICAqIEFsbG93IGNvbnN1bWVyIHRvIHByZXZlbnQgbGlicmFyeSB0byByZS1lbmNvZGUgY29udGVudCBpZiBpdCdzIGFscmVhZHkgZW5jb2RlZFxuICAgICAqL1xuICAgIHRoaXMuaXNFbmNvZGVkID0gb3B0aW9ucy5pc0VuY29kZWQgfHwgZmFsc2VcblxuICAgIC8qKlxuICAgICAqIFJvb3Qgbm9kZSBmb3IgY3VycmVudCBtaW1lIHRyZWVcbiAgICAgKi9cbiAgICB0aGlzLnJvb3ROb2RlID0gb3B0aW9ucy5yb290Tm9kZSB8fCB0aGlzXG5cbiAgICAvKipcbiAgICAgKiBJZiBmaWxlbmFtZSBpcyBzcGVjaWZpZWQgYnV0IGNvbnRlbnRUeXBlIGlzIG5vdCAocHJvYmFibHkgYW4gYXR0YWNobWVudClcbiAgICAgKiBkZXRlY3QgdGhlIGNvbnRlbnQgdHlwZSBmcm9tIGZpbGVuYW1lIGV4dGVuc2lvblxuICAgICAqL1xuICAgIGlmIChvcHRpb25zLmZpbGVuYW1lKSB7XG4gICAgICAvKipcbiAgICAgICAqIEZpbGVuYW1lIGZvciB0aGlzIG5vZGUuIFVzZWZ1bCB3aXRoIGF0dGFjaG1lbnRzXG4gICAgICAgKi9cbiAgICAgIHRoaXMuZmlsZW5hbWUgPSBvcHRpb25zLmZpbGVuYW1lXG4gICAgICBpZiAoIWNvbnRlbnRUeXBlKSB7XG4gICAgICAgIGNvbnRlbnRUeXBlID0gZGV0ZWN0TWltZVR5cGUodGhpcy5maWxlbmFtZS5zcGxpdCgnLicpLnBvcCgpKVxuICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEltbWVkaWF0ZSBwYXJlbnQgZm9yIHRoaXMgbm9kZSAob3IgdW5kZWZpbmVkIGlmIG5vdCBzZXQpXG4gICAgICovXG4gICAgdGhpcy5wYXJlbnROb2RlID0gb3B0aW9ucy5wYXJlbnROb2RlXG5cbiAgICAvKipcbiAgICAgKiBVc2VkIGZvciBnZW5lcmF0aW5nIHVuaXF1ZSBib3VuZGFyaWVzIChwcmVwZW5kZWQgdG8gdGhlIHNoYXJlZCBiYXNlKVxuICAgICAqL1xuICAgIHRoaXMuX25vZGVJZCA9ICsrdGhpcy5yb290Tm9kZS5ub2RlQ291bnRlclxuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgZm9yIHBvc3NpYmxlIGNoaWxkIG5vZGVzXG4gICAgICovXG4gICAgdGhpcy5fY2hpbGROb2RlcyA9IFtdXG5cbiAgICAvKipcbiAgICAgKiBBIGxpc3Qgb2YgaGVhZGVyIHZhbHVlcyBmb3IgdGhpcyBub2RlIGluIHRoZSBmb3JtIG9mIFt7a2V5OicnLCB2YWx1ZTonJ31dXG4gICAgICovXG4gICAgdGhpcy5faGVhZGVycyA9IFtdXG5cbiAgICAvKipcbiAgICAgKiBJZiBjb250ZW50IHR5cGUgaXMgc2V0IChvciBkZXJpdmVkIGZyb20gdGhlIGZpbGVuYW1lKSBhZGQgaXQgdG8gaGVhZGVyc1xuICAgICAqL1xuICAgIGlmIChjb250ZW50VHlwZSkge1xuICAgICAgdGhpcy5zZXRIZWFkZXIoJ2NvbnRlbnQtdHlwZScsIGNvbnRlbnRUeXBlKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlbiBCQ0MgaGVhZGVyIGlzIGluY2x1ZGVkIGluIFJGQzI4MjIgbWVzc2FnZS5cbiAgICAgKi9cbiAgICB0aGlzLmluY2x1ZGVCY2NJbkhlYWRlciA9IG9wdGlvbnMuaW5jbHVkZUJjY0luSGVhZGVyIHx8IGZhbHNlXG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbmQgYXBwZW5kcyBhIGNoaWxkIG5vZGUuIEFyZ3VtZW50cyBwcm92aWRlZCBhcmUgcGFzc2VkIHRvIE1pbWVOb2RlIGNvbnN0cnVjdG9yXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbY29udGVudFR5cGVdIE9wdGlvbmFsIGNvbnRlbnQgdHlwZVxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gQ3JlYXRlZCBub2RlIG9iamVjdFxuICAgKi9cbiAgY3JlYXRlQ2hpbGQgKGNvbnRlbnRUeXBlLCBvcHRpb25zID0ge30pIHtcbiAgICB2YXIgbm9kZSA9IG5ldyBNaW1lTm9kZShjb250ZW50VHlwZSwgb3B0aW9ucylcbiAgICB0aGlzLmFwcGVuZENoaWxkKG5vZGUpXG4gICAgcmV0dXJuIG5vZGVcbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBlbmRzIGFuIGV4aXN0aW5nIG5vZGUgdG8gdGhlIG1pbWUgdHJlZS4gUmVtb3ZlcyB0aGUgbm9kZSBmcm9tIGFuIGV4aXN0aW5nXG4gICAqIHRyZWUgaWYgbmVlZGVkXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjaGlsZE5vZGUgbm9kZSB0byBiZSBhcHBlbmRlZFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IEFwcGVuZGVkIG5vZGUgb2JqZWN0XG4gICAqL1xuICBhcHBlbmRDaGlsZCAoY2hpbGROb2RlKSB7XG4gICAgaWYgKGNoaWxkTm9kZS5yb290Tm9kZSAhPT0gdGhpcy5yb290Tm9kZSkge1xuICAgICAgY2hpbGROb2RlLnJvb3ROb2RlID0gdGhpcy5yb290Tm9kZVxuICAgICAgY2hpbGROb2RlLl9ub2RlSWQgPSArK3RoaXMucm9vdE5vZGUubm9kZUNvdW50ZXJcbiAgICB9XG5cbiAgICBjaGlsZE5vZGUucGFyZW50Tm9kZSA9IHRoaXNcblxuICAgIHRoaXMuX2NoaWxkTm9kZXMucHVzaChjaGlsZE5vZGUpXG4gICAgcmV0dXJuIGNoaWxkTm9kZVxuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxhY2VzIGN1cnJlbnQgbm9kZSB3aXRoIGFub3RoZXIgbm9kZVxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gbm9kZSBSZXBsYWNlbWVudCBub2RlXG4gICAqIEByZXR1cm4ge09iamVjdH0gUmVwbGFjZW1lbnQgbm9kZVxuICAgKi9cbiAgcmVwbGFjZSAobm9kZSkge1xuICAgIGlmIChub2RlID09PSB0aGlzKSB7XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIHRoaXMucGFyZW50Tm9kZS5fY2hpbGROb2Rlcy5mb3JFYWNoKChjaGlsZE5vZGUsIGkpID0+IHtcbiAgICAgIGlmIChjaGlsZE5vZGUgPT09IHRoaXMpIHtcbiAgICAgICAgbm9kZS5yb290Tm9kZSA9IHRoaXMucm9vdE5vZGVcbiAgICAgICAgbm9kZS5wYXJlbnROb2RlID0gdGhpcy5wYXJlbnROb2RlXG4gICAgICAgIG5vZGUuX25vZGVJZCA9IHRoaXMuX25vZGVJZFxuXG4gICAgICAgIHRoaXMucm9vdE5vZGUgPSB0aGlzXG4gICAgICAgIHRoaXMucGFyZW50Tm9kZSA9IHVuZGVmaW5lZFxuXG4gICAgICAgIG5vZGUucGFyZW50Tm9kZS5fY2hpbGROb2Rlc1tpXSA9IG5vZGVcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIG5vZGVcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGN1cnJlbnQgbm9kZSBmcm9tIHRoZSBtaW1lIHRyZWVcbiAgICpcbiAgICogQHJldHVybiB7T2JqZWN0fSByZW1vdmVkIG5vZGVcbiAgICovXG4gIHJlbW92ZSAoKSB7XG4gICAgaWYgKCF0aGlzLnBhcmVudE5vZGUpIHtcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGFyZW50Tm9kZS5fY2hpbGROb2Rlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKHRoaXMucGFyZW50Tm9kZS5fY2hpbGROb2Rlc1tpXSA9PT0gdGhpcykge1xuICAgICAgICB0aGlzLnBhcmVudE5vZGUuX2NoaWxkTm9kZXMuc3BsaWNlKGksIDEpXG4gICAgICAgIHRoaXMucGFyZW50Tm9kZSA9IHVuZGVmaW5lZFxuICAgICAgICB0aGlzLnJvb3ROb2RlID0gdGhpc1xuICAgICAgICByZXR1cm4gdGhpc1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIGEgaGVhZGVyIHZhbHVlLiBJZiB0aGUgdmFsdWUgZm9yIHNlbGVjdGVkIGtleSBleGlzdHMsIGl0IGlzIG92ZXJ3cml0dGVuLlxuICAgKiBZb3UgY2FuIHNldCBtdWx0aXBsZSB2YWx1ZXMgYXMgd2VsbCBieSB1c2luZyBbe2tleTonJywgdmFsdWU6Jyd9XSBvclxuICAgKiB7a2V5OiAndmFsdWUnfSBhcyB0aGUgZmlyc3QgYXJndW1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fE9iamVjdH0ga2V5IEhlYWRlciBrZXkgb3IgYSBsaXN0IG9mIGtleSB2YWx1ZSBwYWlyc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgSGVhZGVyIHZhbHVlXG4gICAqIEByZXR1cm4ge09iamVjdH0gY3VycmVudCBub2RlXG4gICAqL1xuICBzZXRIZWFkZXIgKGtleSwgdmFsdWUpIHtcbiAgICBsZXQgYWRkZWQgPSBmYWxzZVxuXG4gICAgLy8gQWxsb3cgc2V0dGluZyBtdWx0aXBsZSBoZWFkZXJzIGF0IG9uY2VcbiAgICBpZiAoIXZhbHVlICYmIGtleSAmJiB0eXBlb2Yga2V5ID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKGtleS5rZXkgJiYga2V5LnZhbHVlKSB7XG4gICAgICAgIC8vIGFsbG93IHtrZXk6J2NvbnRlbnQtdHlwZScsIHZhbHVlOiAndGV4dC9wbGFpbid9XG4gICAgICAgIHRoaXMuc2V0SGVhZGVyKGtleS5rZXksIGtleS52YWx1ZSlcbiAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShrZXkpKSB7XG4gICAgICAgIC8vIGFsbG93IFt7a2V5Oidjb250ZW50LXR5cGUnLCB2YWx1ZTogJ3RleHQvcGxhaW4nfV1cbiAgICAgICAga2V5LmZvckVhY2goaSA9PiB0aGlzLnNldEhlYWRlcihpLmtleSwgaS52YWx1ZSkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBhbGxvdyB7J2NvbnRlbnQtdHlwZSc6ICd0ZXh0L3BsYWluJ31cbiAgICAgICAgT2JqZWN0LmtleXMoa2V5KS5mb3JFYWNoKGkgPT4gdGhpcy5zZXRIZWFkZXIoaSwga2V5W2ldKSlcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAga2V5ID0gbm9ybWFsaXplSGVhZGVyS2V5KGtleSlcblxuICAgIGNvbnN0IGhlYWRlclZhbHVlID0geyBrZXksIHZhbHVlIH1cblxuICAgIC8vIENoZWNrIGlmIHRoZSB2YWx1ZSBleGlzdHMgYW5kIG92ZXJ3cml0ZVxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLl9oZWFkZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5faGVhZGVyc1tpXS5rZXkgPT09IGtleSkge1xuICAgICAgICBpZiAoIWFkZGVkKSB7XG4gICAgICAgICAgLy8gcmVwbGFjZSB0aGUgZmlyc3QgbWF0Y2hcbiAgICAgICAgICB0aGlzLl9oZWFkZXJzW2ldID0gaGVhZGVyVmFsdWVcbiAgICAgICAgICBhZGRlZCA9IHRydWVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyByZW1vdmUgZm9sbG93aW5nIG1hdGNoZXNcbiAgICAgICAgICB0aGlzLl9oZWFkZXJzLnNwbGljZShpLCAxKVxuICAgICAgICAgIGktLVxuICAgICAgICAgIGxlbi0tXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBtYXRjaCBub3QgZm91bmQsIGFwcGVuZCB0aGUgdmFsdWVcbiAgICBpZiAoIWFkZGVkKSB7XG4gICAgICB0aGlzLl9oZWFkZXJzLnB1c2goaGVhZGVyVmFsdWUpXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgaGVhZGVyIHZhbHVlLiBJZiB0aGUgdmFsdWUgZm9yIHNlbGVjdGVkIGtleSBleGlzdHMsIHRoZSB2YWx1ZSBpcyBhcHBlbmRlZFxuICAgKiBhcyBhIG5ldyBmaWVsZCBhbmQgb2xkIG9uZSBpcyBub3QgdG91Y2hlZC5cbiAgICogWW91IGNhbiBzZXQgbXVsdGlwbGUgdmFsdWVzIGFzIHdlbGwgYnkgdXNpbmcgW3trZXk6JycsIHZhbHVlOicnfV0gb3JcbiAgICoge2tleTogJ3ZhbHVlJ30gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxPYmplY3R9IGtleSBIZWFkZXIga2V5IG9yIGEgbGlzdCBvZiBrZXkgdmFsdWUgcGFpcnNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIEhlYWRlciB2YWx1ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9IGN1cnJlbnQgbm9kZVxuICAgKi9cbiAgYWRkSGVhZGVyIChrZXksIHZhbHVlKSB7XG4gICAgLy8gQWxsb3cgc2V0dGluZyBtdWx0aXBsZSBoZWFkZXJzIGF0IG9uY2VcbiAgICBpZiAoIXZhbHVlICYmIGtleSAmJiB0eXBlb2Yga2V5ID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKGtleS5rZXkgJiYga2V5LnZhbHVlKSB7XG4gICAgICAgIC8vIGFsbG93IHtrZXk6J2NvbnRlbnQtdHlwZScsIHZhbHVlOiAndGV4dC9wbGFpbid9XG4gICAgICAgIHRoaXMuYWRkSGVhZGVyKGtleS5rZXksIGtleS52YWx1ZSlcbiAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShrZXkpKSB7XG4gICAgICAgIC8vIGFsbG93IFt7a2V5Oidjb250ZW50LXR5cGUnLCB2YWx1ZTogJ3RleHQvcGxhaW4nfV1cbiAgICAgICAga2V5LmZvckVhY2goaSA9PiB0aGlzLmFkZEhlYWRlcihpLmtleSwgaS52YWx1ZSkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBhbGxvdyB7J2NvbnRlbnQtdHlwZSc6ICd0ZXh0L3BsYWluJ31cbiAgICAgICAgT2JqZWN0LmtleXMoa2V5KS5mb3JFYWNoKGkgPT4gdGhpcy5hZGRIZWFkZXIoaSwga2V5W2ldKSlcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgdGhpcy5faGVhZGVycy5wdXNoKHsga2V5OiBub3JtYWxpemVIZWFkZXJLZXkoa2V5KSwgdmFsdWUgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSBmaXJzdCBtYXRoY2luZyB2YWx1ZSBvZiBhIHNlbGVjdGVkIGtleVxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IEtleSB0byBzZWFyY2ggZm9yXG4gICAqIEByZXR1biB7U3RyaW5nfSBWYWx1ZSBmb3IgdGhlIGtleVxuICAgKi9cbiAgZ2V0SGVhZGVyIChrZXkpIHtcbiAgICBrZXkgPSBub3JtYWxpemVIZWFkZXJLZXkoa2V5KVxuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9oZWFkZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5faGVhZGVyc1tpXS5rZXkgPT09IGtleSkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGVhZGVyc1tpXS52YWx1ZVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIGJvZHkgY29udGVudCBmb3IgY3VycmVudCBub2RlLiBJZiB0aGUgdmFsdWUgaXMgYSBzdHJpbmcsIGNoYXJzZXQgaXMgYWRkZWQgYXV0b21hdGljYWxseVxuICAgKiB0byBDb250ZW50LVR5cGUgKGlmIGl0IGlzIHRleHQvKikuIElmIHRoZSB2YWx1ZSBpcyBhIFR5cGVkIEFycmF5LCB5b3UgbmVlZCB0byBzcGVjaWZ5XG4gICAqIHRoZSBjaGFyc2V0IHlvdXJzZWxmXG4gICAqXG4gICAqIEBwYXJhbSAoU3RyaW5nfFVpbnQ4QXJyYXkpIGNvbnRlbnQgQm9keSBjb250ZW50XG4gICAqIEByZXR1cm4ge09iamVjdH0gY3VycmVudCBub2RlXG4gICAqL1xuICBzZXRDb250ZW50IChjb250ZW50KSB7XG4gICAgdGhpcy5jb250ZW50ID0gY29udGVudFxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIHRoZSByZmMyODIyIG1lc3NhZ2UgZnJvbSB0aGUgY3VycmVudCBub2RlLlxuICAgKlxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IENvbXBpbGVkIG1lc3NhZ2VcbiAgICovXG4gIGJ1aWxkICgpIHtcbiAgICBjb25zdCBsaW5lcyA9IFtdXG4gICAgY29uc3QgY29udGVudFR5cGUgPSAodGhpcy5nZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScpIHx8ICcnKS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkudHJpbSgpXG4gICAgbGV0IHRyYW5zZmVyRW5jb2RpbmdcbiAgICBsZXQgZmxvd2VkXG5cbiAgICBpZiAodGhpcy5jb250ZW50KSB7XG4gICAgICB0cmFuc2ZlckVuY29kaW5nID0gKHRoaXMuZ2V0SGVhZGVyKCdDb250ZW50LVRyYW5zZmVyLUVuY29kaW5nJykgfHwgJycpLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKS50cmltKClcbiAgICAgIGlmICghdHJhbnNmZXJFbmNvZGluZyB8fCBbJ2Jhc2U2NCcsICdxdW90ZWQtcHJpbnRhYmxlJ10uaW5kZXhPZih0cmFuc2ZlckVuY29kaW5nKSA8IDApIHtcbiAgICAgICAgaWYgKC9edGV4dFxcLy9pLnRlc3QoY29udGVudFR5cGUpKSB7XG4gICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIHNwZWNpYWwgc3ltYm9scywgbm8gbmVlZCB0byBtb2RpZnkgdGhlIHRleHRcbiAgICAgICAgICBpZiAoaXNQbGFpblRleHQodGhpcy5jb250ZW50KSkge1xuICAgICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIGxpbmVzIGxvbmdlciB0aGFuIDc2IHN5bWJvbHMvYnl0ZXMsIG1ha2UgdGhlIHRleHQgJ2Zsb3dlZCdcbiAgICAgICAgICAgIGlmICgvXi57NzcsfS9tLnRlc3QodGhpcy5jb250ZW50KSkge1xuICAgICAgICAgICAgICBmbG93ZWQgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cmFuc2ZlckVuY29kaW5nID0gJzdiaXQnXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyYW5zZmVyRW5jb2RpbmcgPSAncXVvdGVkLXByaW50YWJsZSdcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoIS9ebXVsdGlwYXJ0XFwvL2kudGVzdChjb250ZW50VHlwZSkpIHtcbiAgICAgICAgICB0cmFuc2ZlckVuY29kaW5nID0gdHJhbnNmZXJFbmNvZGluZyB8fCAnYmFzZTY0J1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0cmFuc2ZlckVuY29kaW5nKSB7XG4gICAgICAgIHRoaXMuc2V0SGVhZGVyKCdDb250ZW50LVRyYW5zZmVyLUVuY29kaW5nJywgdHJhbnNmZXJFbmNvZGluZylcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5maWxlbmFtZSAmJiAhdGhpcy5nZXRIZWFkZXIoJ0NvbnRlbnQtRGlzcG9zaXRpb24nKSkge1xuICAgICAgdGhpcy5zZXRIZWFkZXIoJ0NvbnRlbnQtRGlzcG9zaXRpb24nLCAnYXR0YWNobWVudCcpXG4gICAgfVxuXG4gICAgdGhpcy5faGVhZGVycy5mb3JFYWNoKGhlYWRlciA9PiB7XG4gICAgICBjb25zdCBrZXkgPSBoZWFkZXIua2V5XG4gICAgICBsZXQgdmFsdWUgPSBoZWFkZXIudmFsdWVcbiAgICAgIGxldCBzdHJ1Y3R1cmVkXG5cbiAgICAgIHN3aXRjaCAoaGVhZGVyLmtleSkge1xuICAgICAgICBjYXNlICdDb250ZW50LURpc3Bvc2l0aW9uJzpcbiAgICAgICAgICBzdHJ1Y3R1cmVkID0gcGFyc2VIZWFkZXJWYWx1ZSh2YWx1ZSlcbiAgICAgICAgICBpZiAodGhpcy5maWxlbmFtZSkge1xuICAgICAgICAgICAgc3RydWN0dXJlZC5wYXJhbXMuZmlsZW5hbWUgPSB0aGlzLmZpbGVuYW1lXG4gICAgICAgICAgfVxuICAgICAgICAgIHZhbHVlID0gYnVpbGRIZWFkZXJWYWx1ZShzdHJ1Y3R1cmVkKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ0NvbnRlbnQtVHlwZSc6XG4gICAgICAgICAgc3RydWN0dXJlZCA9IHBhcnNlSGVhZGVyVmFsdWUodmFsdWUpXG5cbiAgICAgICAgICB0aGlzLl9hZGRCb3VuZGFyeShzdHJ1Y3R1cmVkKVxuXG4gICAgICAgICAgaWYgKGZsb3dlZCkge1xuICAgICAgICAgICAgc3RydWN0dXJlZC5wYXJhbXMuZm9ybWF0ID0gJ2Zsb3dlZCdcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKFN0cmluZyhzdHJ1Y3R1cmVkLnBhcmFtcy5mb3JtYXQpLnRvTG93ZXJDYXNlKCkudHJpbSgpID09PSAnZmxvd2VkJykge1xuICAgICAgICAgICAgZmxvd2VkID0gdHJ1ZVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzdHJ1Y3R1cmVkLnZhbHVlLm1hdGNoKC9edGV4dFxcLy8pICYmIHR5cGVvZiB0aGlzLmNvbnRlbnQgPT09ICdzdHJpbmcnICYmIC9bXFx1MDA4MC1cXHVGRkZGXS8udGVzdCh0aGlzLmNvbnRlbnQpKSB7XG4gICAgICAgICAgICBzdHJ1Y3R1cmVkLnBhcmFtcy5jaGFyc2V0ID0gJ3V0Zi04J1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhbHVlID0gYnVpbGRIZWFkZXJWYWx1ZShzdHJ1Y3R1cmVkKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ0JjYyc6XG4gICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZUJjY0luSGVhZGVyID09PSBmYWxzZSkge1xuICAgICAgICAgICAgLy8gc2tpcCBCQ0MgdmFsdWVzXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIHNraXAgZW1wdHkgbGluZXNcbiAgICAgIHZhbHVlID0gZW5jb2RlSGVhZGVyVmFsdWUoa2V5LCB2YWx1ZSlcbiAgICAgIGlmICghKHZhbHVlIHx8ICcnKS50b1N0cmluZygpLnRyaW0oKSkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgbGluZXMucHVzaChmb2xkTGluZXMoa2V5ICsgJzogJyArIHZhbHVlKSlcbiAgICB9KVxuXG4gICAgbGluZXMucHVzaCgnJylcblxuICAgIGlmICh0aGlzLmNvbnRlbnQpIHtcbiAgICAgIGlmICh0aGlzLmlzRW5jb2RlZCkge1xuICAgICAgICBsaW5lcy5wdXNoKHRoaXMuY29udGVudC5yZXBsYWNlKC9cXHI/XFxuL2csICdcXHJcXG4nKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN3aXRjaCAodHJhbnNmZXJFbmNvZGluZykge1xuICAgICAgICAgIGNhc2UgJ3F1b3RlZC1wcmludGFibGUnOlxuICAgICAgICAgICAgbGluZXMucHVzaChxdW90ZWRQcmludGFibGVFbmNvZGUodGhpcy5jb250ZW50KSlcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgICAgIGxpbmVzLnB1c2goYmFzZTY0RW5jb2RlKHRoaXMuY29udGVudCwgdHlwZW9mIHRoaXMuY29udGVudCA9PT0gJ29iamVjdCcgPyAnYmluYXJ5JyA6IHVuZGVmaW5lZCkpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBpZiAoZmxvd2VkKSB7XG4gICAgICAgICAgICAgIC8vIHNwYWNlIHN0dWZmaW5nIGh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM2NzYjc2VjdGlvbi00LjJcbiAgICAgICAgICAgICAgbGluZXMucHVzaChmb2xkTGluZXModGhpcy5jb250ZW50LnJlcGxhY2UoL1xccj9cXG4vZywgJ1xcclxcbicpLnJlcGxhY2UoL14oIHxGcm9tfD4pL2lnbSwgJyAkMScpLCA3NiwgdHJ1ZSkpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsaW5lcy5wdXNoKHRoaXMuY29udGVudC5yZXBsYWNlKC9cXHI/XFxuL2csICdcXHJcXG4nKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubXVsdGlwYXJ0ICYmIHRoaXMuX2NoaWxkTm9kZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBsaW5lcy5wdXNoKCcnKVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLm11bHRpcGFydCAmJiB0aGlzLl9jaGlsZE5vZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuX2NoaWxkTm9kZXMuZm9yRWFjaChub2RlID0+IHtcbiAgICAgICAgbGluZXMucHVzaCgnLS0nICsgdGhpcy5ib3VuZGFyeSlcbiAgICAgICAgbGluZXMucHVzaChub2RlLmJ1aWxkKCkpXG4gICAgICB9KVxuICAgICAgbGluZXMucHVzaCgnLS0nICsgdGhpcy5ib3VuZGFyeSArICctLScpXG4gICAgICBsaW5lcy5wdXNoKCcnKVxuICAgIH1cblxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXHJcXG4nKVxuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlcyBhbmQgcmV0dXJucyBTTVRQIGVudmVsb3BlIHdpdGggdGhlIHNlbmRlciBhZGRyZXNzIGFuZCBhIGxpc3Qgb2YgcmVjaXBpZW50cyBhZGRyZXNzZXNcbiAgICpcbiAgICogQHJldHVybiB7T2JqZWN0fSBTTVRQIGVudmVsb3BlIGluIHRoZSBmb3JtIG9mIHtmcm9tOiAnZnJvbUBleGFtcGxlLmNvbScsIHRvOiBbJ3RvQGV4YW1wbGUuY29tJ119XG4gICAqL1xuICBnZXRFbnZlbG9wZSAoKSB7XG4gICAgdmFyIGVudmVsb3BlID0ge1xuICAgICAgZnJvbTogZmFsc2UsXG4gICAgICB0bzogW11cbiAgICB9XG4gICAgdGhpcy5faGVhZGVycy5mb3JFYWNoKGhlYWRlciA9PiB7XG4gICAgICB2YXIgbGlzdCA9IFtdXG4gICAgICBpZiAoaGVhZGVyLmtleSA9PT0gJ0Zyb20nIHx8ICghZW52ZWxvcGUuZnJvbSAmJiBbJ1JlcGx5LVRvJywgJ1NlbmRlciddLmluZGV4T2YoaGVhZGVyLmtleSkgPj0gMCkpIHtcbiAgICAgICAgY29udmVydEFkZHJlc3NlcyhwYXJzZUFkZHJlc3NlcyhoZWFkZXIudmFsdWUpLCBsaXN0KVxuICAgICAgICBpZiAobGlzdC5sZW5ndGggJiYgbGlzdFswXSkge1xuICAgICAgICAgIGVudmVsb3BlLmZyb20gPSBsaXN0WzBdXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoWydUbycsICdDYycsICdCY2MnXS5pbmRleE9mKGhlYWRlci5rZXkpID49IDApIHtcbiAgICAgICAgY29udmVydEFkZHJlc3NlcyhwYXJzZUFkZHJlc3NlcyhoZWFkZXIudmFsdWUpLCBlbnZlbG9wZS50bylcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIGVudmVsb3BlXG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSBjb250ZW50IHR5cGUgaXMgbXVsdGlwYXJ0IGFuZCBkZWZpbmVzIGJvdW5kYXJ5IGlmIG5lZWRlZC5cbiAgICogRG9lc24ndCByZXR1cm4gYW55dGhpbmcsIG1vZGlmaWVzIG9iamVjdCBhcmd1bWVudCBpbnN0ZWFkLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gc3RydWN0dXJlZCBQYXJzZWQgaGVhZGVyIHZhbHVlIGZvciAnQ29udGVudC1UeXBlJyBrZXlcbiAgICovXG4gIF9hZGRCb3VuZGFyeSAoc3RydWN0dXJlZCkge1xuICAgIHRoaXMuY29udGVudFR5cGUgPSBzdHJ1Y3R1cmVkLnZhbHVlLnRyaW0oKS50b0xvd2VyQ2FzZSgpXG5cbiAgICB0aGlzLm11bHRpcGFydCA9IHRoaXMuY29udGVudFR5cGUuc3BsaXQoJy8nKS5yZWR1Y2UoZnVuY3Rpb24gKHByZXYsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gcHJldiA9PT0gJ211bHRpcGFydCcgPyB2YWx1ZSA6IGZhbHNlXG4gICAgfSlcblxuICAgIGlmICh0aGlzLm11bHRpcGFydCkge1xuICAgICAgdGhpcy5ib3VuZGFyeSA9IHN0cnVjdHVyZWQucGFyYW1zLmJvdW5kYXJ5ID0gc3RydWN0dXJlZC5wYXJhbXMuYm91bmRhcnkgfHwgdGhpcy5ib3VuZGFyeSB8fCBnZW5lcmF0ZUJvdW5kYXJ5KHRoaXMuX25vZGVJZCwgdGhpcy5yb290Tm9kZS5iYXNlQm91bmRhcnkpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYm91bmRhcnkgPSBmYWxzZVxuICAgIH1cbiAgfVxufVxuIl19
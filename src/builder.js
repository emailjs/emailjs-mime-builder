import {
  base64Encode,
  quotedPrintableEncode,
  foldLines,
  parseHeaderValue
} from 'emailjs-mime-codec'
import { detectMimeType } from 'emailjs-mime-types'
import {
  convertAddresses,
  parseAddresses,
  encodeHeaderValue,
  normalizeHeaderKey,
  generateBoundary,
  isPlainText,
  buildHeaderValue
} from './utils'

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
export default class MimeNode {
  constructor (contentType, options = {}) {
    this.nodeCounter = 0

    /**
     * shared part of the unique multipart boundary
     */
    this.baseBoundary = options.baseBoundary || Date.now().toString() + Math.random()

    /**
     * If date headers is missing and current node is the root, this value is used instead
     */
    this.date = new Date()

    /**
     * Allow consumer to prevent library to re-encode content if it's already encoded
     */
    this.isEncoded = options.isEncoded || false

    /**
     * Root node for current mime tree
     */
    this.rootNode = options.rootNode || this

    /**
     * If filename is specified but contentType is not (probably an attachment)
     * detect the content type from filename extension
     */
    if (options.filename) {
      /**
       * Filename for this node. Useful with attachments
       */
      this.filename = options.filename
      if (!contentType) {
        contentType = detectMimeType(this.filename.split('.').pop())
      }
    }

    /**
     * Immediate parent for this node (or undefined if not set)
     */
    this.parentNode = options.parentNode

    /**
     * Used for generating unique boundaries (prepended to the shared base)
     */
    this._nodeId = ++this.rootNode.nodeCounter

    /**
     * An array for possible child nodes
     */
    this._childNodes = []

    /**
     * A list of header values for this node in the form of [{key:'', value:''}]
     */
    this._headers = []

    /**
     * If content type is set (or derived from the filename) add it to headers
     */
    if (contentType) {
      this.setHeader('content-type', contentType)
    }

    /**
     * If true then BCC header is included in RFC2822 message.
     */
    this.includeBccInHeader = options.includeBccInHeader || false
  }

  /**
   * Creates and appends a child node. Arguments provided are passed to MimeNode constructor
   *
   * @param {String} [contentType] Optional content type
   * @param {Object} [options] Optional options object
   * @return {Object} Created node object
   */
  createChild (contentType, options = {}) {
    var node = new MimeNode(contentType, options)
    this.appendChild(node)
    return node
  }

  /**
   * Appends an existing node to the mime tree. Removes the node from an existing
   * tree if needed
   *
   * @param {Object} childNode node to be appended
   * @return {Object} Appended node object
   */
  appendChild (childNode) {
    if (childNode.rootNode !== this.rootNode) {
      childNode.rootNode = this.rootNode
      childNode._nodeId = ++this.rootNode.nodeCounter
    }

    childNode.parentNode = this

    this._childNodes.push(childNode)
    return childNode
  }

  /**
   * Replaces current node with another node
   *
   * @param {Object} node Replacement node
   * @return {Object} Replacement node
   */
  replace (node) {
    if (node === this) {
      return this
    }

    this.parentNode._childNodes.forEach((childNode, i) => {
      if (childNode === this) {
        node.rootNode = this.rootNode
        node.parentNode = this.parentNode
        node._nodeId = this._nodeId

        this.rootNode = this
        this.parentNode = undefined

        node.parentNode._childNodes[i] = node
      }
    })

    return node
  }

  /**
   * Removes current node from the mime tree
   *
   * @return {Object} removed node
   */
  remove () {
    if (!this.parentNode) {
      return this
    }

    for (var i = this.parentNode._childNodes.length - 1; i >= 0; i--) {
      if (this.parentNode._childNodes[i] === this) {
        this.parentNode._childNodes.splice(i, 1)
        this.parentNode = undefined
        this.rootNode = this
        return this
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
  setHeader (key, value) {
    let added = false

    // Allow setting multiple headers at once
    if (!value && key && typeof key === 'object') {
      if (key.key && key.value) {
        // allow {key:'content-type', value: 'text/plain'}
        this.setHeader(key.key, key.value)
      } else if (Array.isArray(key)) {
        // allow [{key:'content-type', value: 'text/plain'}]
        key.forEach(i => this.setHeader(i.key, i.value))
      } else {
        // allow {'content-type': 'text/plain'}
        Object.keys(key).forEach(i => this.setHeader(i, key[i]))
      }
      return this
    }

    key = normalizeHeaderKey(key)

    const headerValue = { key, value }

    // Check if the value exists and overwrite
    for (var i = 0, len = this._headers.length; i < len; i++) {
      if (this._headers[i].key === key) {
        if (!added) {
          // replace the first match
          this._headers[i] = headerValue
          added = true
        } else {
          // remove following matches
          this._headers.splice(i, 1)
          i--
          len--
        }
      }
    }

    // match not found, append the value
    if (!added) {
      this._headers.push(headerValue)
    }

    return this
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
  addHeader (key, value) {
    // Allow setting multiple headers at once
    if (!value && key && typeof key === 'object') {
      if (key.key && key.value) {
        // allow {key:'content-type', value: 'text/plain'}
        this.addHeader(key.key, key.value)
      } else if (Array.isArray(key)) {
        // allow [{key:'content-type', value: 'text/plain'}]
        key.forEach(i => this.addHeader(i.key, i.value))
      } else {
        // allow {'content-type': 'text/plain'}
        Object.keys(key).forEach(i => this.addHeader(i, key[i]))
      }
      return this
    }

    this._headers.push({ key: normalizeHeaderKey(key), value })

    return this
  }

  /**
   * Retrieves the first mathcing value of a selected key
   *
   * @param {String} key Key to search for
   * @retun {String} Value for the key
   */
  getHeader (key) {
    key = normalizeHeaderKey(key)
    for (let i = 0, len = this._headers.length; i < len; i++) {
      if (this._headers[i].key === key) {
        return this._headers[i].value
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
  setContent (content) {
    this.content = content
    return this
  }

  /**
   * Builds the rfc2822 message from the current node.
   *
   * @return {String} Compiled message
   */
  build () {
    const lines = []
    const contentType = (this.getHeader('Content-Type') || '').toString().toLowerCase().trim()
    let transferEncoding
    let flowed

    if (this.content) {
      transferEncoding = (this.getHeader('Content-Transfer-Encoding') || '').toString().toLowerCase().trim()
      if (!transferEncoding || ['base64', 'quoted-printable'].indexOf(transferEncoding) < 0) {
        if (/^text\//i.test(contentType)) {
          // If there are no special symbols, no need to modify the text
          if (isPlainText(this.content)) {
            // If there are lines longer than 76 symbols/bytes, make the text 'flowed'
            if (/^.{77,}/m.test(this.content)) {
              flowed = true
            }
            transferEncoding = '7bit'
          } else {
            transferEncoding = 'quoted-printable'
          }
        } else if (!/^multipart\//i.test(contentType)) {
          transferEncoding = transferEncoding || 'base64'
        }
      }

      if (transferEncoding) {
        this.setHeader('Content-Transfer-Encoding', transferEncoding)
      }
    }

    if (this.filename && !this.getHeader('Content-Disposition')) {
      this.setHeader('Content-Disposition', 'attachment')
    }

    this._headers.forEach(header => {
      const key = header.key
      let value = header.value
      let structured

      switch (header.key) {
        case 'Content-Disposition':
          structured = parseHeaderValue(value)
          if (this.filename) {
            structured.params.filename = this.filename
          }
          value = buildHeaderValue(structured)
          break
        case 'Content-Type':
          structured = parseHeaderValue(value)

          this._addBoundary(structured)

          if (flowed) {
            structured.params.format = 'flowed'
          }
          if (String(structured.params.format).toLowerCase().trim() === 'flowed') {
            flowed = true
          }

          if (structured.value.match(/^text\//) && typeof this.content === 'string' && /[\u0080-\uFFFF]/.test(this.content)) {
            structured.params.charset = 'utf-8'
          }

          value = buildHeaderValue(structured)
          break
        case 'Bcc':
          if (this.includeBccInHeader === false) {
            // skip BCC values
            return
          }
      }

      // skip empty lines
      value = encodeHeaderValue(key, value)
      if (!(value || '').toString().trim()) {
        return
      }

      lines.push(foldLines(key + ': ' + value))
    })

    lines.push('')

    if (this.content) {
      if (this.isEncoded) {
        lines.push(this.content.replace(/\r?\n/g, '\r\n'))
      } else {
        switch (transferEncoding) {
          case 'quoted-printable':
            lines.push(quotedPrintableEncode(this.content))
            break
          case 'base64':
            lines.push(base64Encode(this.content, typeof this.content === 'object' ? 'binary' : undefined))
            break
          default:
            if (flowed) {
              // space stuffing http://tools.ietf.org/html/rfc3676#section-4.2
              lines.push(foldLines(this.content.replace(/\r?\n/g, '\r\n').replace(/^( |From|>)/igm, ' $1'), 76, true))
            } else {
              lines.push(this.content.replace(/\r?\n/g, '\r\n'))
            }
        }
      }
      if (this.multipart && this._childNodes.length > 0) {
        lines.push('')
      }
    }

    if (this.multipart && this._childNodes.length > 0) {
      this._childNodes.forEach(node => {
        lines.push('--' + this.boundary)
        lines.push(node.build())
      })
      lines.push('--' + this.boundary + '--')
      lines.push('')
    }

    return lines.join('\r\n')
  }

  /**
   * Generates and returns SMTP envelope with the sender address and a list of recipients addresses
   *
   * @return {Object} SMTP envelope in the form of {from: 'from@example.com', to: ['to@example.com']}
   */
  getEnvelope () {
    var envelope = {
      from: false,
      to: []
    }
    this._headers.forEach(header => {
      var list = []
      if (header.key === 'From' || (!envelope.from && ['Reply-To', 'Sender'].indexOf(header.key) >= 0)) {
        convertAddresses(parseAddresses(header.value), list)
        if (list.length && list[0]) {
          envelope.from = list[0]
        }
      } else if (['To', 'Cc', 'Bcc'].indexOf(header.key) >= 0) {
        convertAddresses(parseAddresses(header.value), envelope.to)
      }
    })

    return envelope
  }

  /**
   * Checks if the content type is multipart and defines boundary if needed.
   * Doesn't return anything, modifies object argument instead.
   *
   * @param {Object} structured Parsed header value for 'Content-Type' key
   */
  _addBoundary (structured) {
    this.contentType = structured.value.trim().toLowerCase()

    this.multipart = this.contentType.split('/').reduce(function (prev, value) {
      return prev === 'multipart' ? value : false
    })

    if (this.multipart) {
      this.boundary = structured.params.boundary = structured.params.boundary || this.boundary || generateBoundary(this._nodeId, this.rootNode.baseBoundary)
    } else {
      this.boundary = false
    }
  }
}

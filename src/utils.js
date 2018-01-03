/* eslint-disable node/no-deprecated-api */
/* eslint-disable no-control-regex */

import { flatten } from 'ramda'
import parseAddress from 'emailjs-addressparser'
import {
  mimeWordsEncode,
  mimeWordEncode,
  continuationEncode
} from 'emailjs-mime-codec'
import { toASCII } from 'punycode'

/**
 * If needed, mime encodes the name part
 *
 * @param {String} name Name part of an address
 * @returns {String} Mime word encoded string if needed
 */
function encodeAddressName (name) {
  if (!/^[\w ']*$/.test(name)) {
    if (/^[\x20-\x7e]*$/.test(name)) {
      return '"' + name.replace(/([\\"])/g, '\\$1') + '"'
    } else {
      return mimeWordEncode(name, 'Q')
    }
  }
  return name
}

/**
 * Checks if a value is plaintext string (uses only printable 7bit chars)
 *
 * @param {String} value String to be tested
 * @returns {Boolean} true if it is a plaintext string
 */
export function isPlainText (value) {
  return !(typeof value !== 'string' || /[\x00-\x08\x0b\x0c\x0e-\x1f\u0080-\uFFFF]/.test(value))
}

/**
 * Rebuilds address object using punycode and other adjustments
 *
 * @param {Array} addresses An array of address objects
 * @param {Array} [uniqueList] An array to be populated with addresses
 * @return {String} address string
 */
export function convertAddresses (addresses = [], uniqueList = []) {
  var values = []

  ;[].concat(addresses).forEach(address => {
    if (address.address) {
      address.address = address.address
        .replace(/^.*?(?=@)/, user => mimeWordsEncode(user, 'Q'))
        .replace(/@.+$/, domain => '@' + toASCII(domain.substr(1)))

      if (!address.name) {
        values.push(address.address)
      } else if (address.name) {
        values.push(encodeAddressName(address.name) + ' <' + address.address + '>')
      }

      if (uniqueList.indexOf(address.address) < 0) {
        uniqueList.push(address.address)
      }
    } else if (address.group) {
      values.push(encodeAddressName(address.name) + ':' + (address.group.length ? convertAddresses(address.group, uniqueList) : '').trim() + ';')
    }
  })

  return values.join(', ')
}

/**
 * Parses addresses. Takes in a single address or an array or an
 * array of address arrays (eg. To: [[first group], [second group],...])
 *
 * @param {Mixed} addresses Addresses to be parsed
 * @return {Array} An array of address objects
 */
export function parseAddresses (addresses = []) {
  return flatten([].concat(addresses).map((address) => {
    if (address && address.address) {
      address = convertAddresses(address)
    }
    return parseAddress(address)
  }))
}

/**
 * Encodes a header value for use in the generated rfc2822 email.
 *
 * @param {String} key Header key
 * @param {String} value Header value
 */
export function encodeHeaderValue (key, value = '') {
  key = normalizeHeaderKey(key)

  switch (key) {
    case 'From':
    case 'Sender':
    case 'To':
    case 'Cc':
    case 'Bcc':
    case 'Reply-To':
      return convertAddresses(parseAddresses(value))

    case 'Message-Id':
    case 'In-Reply-To':
    case 'Content-Id':
      value = value.replace(/\r?\n|\r/g, ' ')

      if (value.charAt(0) !== '<') {
        value = '<' + value
      }

      if (value.charAt(value.length - 1) !== '>') {
        value = value + '>'
      }
      return value

    case 'References':
      value = [].concat.apply([], [].concat(value).map((elm = '') => elm
        .replace(/\r?\n|\r/g, ' ')
        .trim()
        .replace(/<[^>]*>/g, str => str.replace(/\s/g, ''))
        .split(/\s+/)
      )).map(function (elm) {
        if (elm.charAt(0) !== '<') {
          elm = '<' + elm
        }
        if (elm.charAt(elm.length - 1) !== '>') {
          elm = elm + '>'
        }
        return elm
      })

      return value.join(' ').trim()

    default:
      return mimeWordsEncode((value || '').toString().replace(/\r?\n|\r/g, ' '), 'B')
  }
}

/**
 * Normalizes a header key, uses Camel-Case form, except for uppercase MIME-
 *
 * @param {String} key Key to be normalized
 * @return {String} key in Camel-Case form
 */
export function normalizeHeaderKey (key = '') {
  return key.replace(/\r?\n|\r/g, ' ') // no newlines in keys
    .trim().toLowerCase()
    .replace(/^MIME\b|^[a-z]|-[a-z]/ig, c => c.toUpperCase()) // use uppercase words, except MIME
}

/**
 * Generates a multipart boundary value
 *
 * @return {String} boundary value
 */
export function generateBoundary (nodeId, baseBoundary) {
  return '----sinikael-?=_' + nodeId + '-' + baseBoundary
}

/**
 * Escapes a header argument value (eg. boundary value for content type),
 * adds surrounding quotes if needed
 *
 * @param {String} value Header argument value
 * @return {String} escaped and quoted (if needed) argument value
 */
export function escapeHeaderArgument (value) {
  if (value.match(/[\s'"\\;/=]|^-/g)) {
    return '"' + value.replace(/(["\\])/g, '\\$1') + '"'
  } else {
    return value
  }
}

/**
 * Joins parsed header value together as 'value; param1=value1; param2=value2'
 *
 * @param {Object} structured Parsed header value
 * @return {String} joined header value
 */
export function buildHeaderValue (structured) {
  var paramsArray = []

  Object.keys(structured.params || {}).forEach(param => {
    // filename might include unicode characters so it is a special case
    if (param === 'filename') {
      continuationEncode(param, structured.params[param], 50).forEach(function (encodedParam) {
        // continuation encoded strings are always escaped, so no need to use enclosing quotes
        // in fact using quotes might end up with invalid filenames in some clients
        paramsArray.push(encodedParam.key + '=' + encodedParam.value)
      })
    } else {
      paramsArray.push(param + '=' + escapeHeaderArgument(structured.params[param]))
    }
  })

  return structured.value + (paramsArray.length ? '; ' + paramsArray.join('; ') : '')
}

'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isPlainText = isPlainText;
exports.convertAddresses = convertAddresses;
exports.parseAddresses = parseAddresses;
exports.encodeHeaderValue = encodeHeaderValue;
exports.normalizeHeaderKey = normalizeHeaderKey;
exports.generateBoundary = generateBoundary;
exports.escapeHeaderArgument = escapeHeaderArgument;
exports.buildHeaderValue = buildHeaderValue;

var _ramda = require('ramda');

var _emailjsAddressparser = require('emailjs-addressparser');

var _emailjsAddressparser2 = _interopRequireDefault(_emailjsAddressparser);

var _emailjsMimeCodec = require('emailjs-mime-codec');

var _punycode = require('punycode');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * If needed, mime encodes the name part
 *
 * @param {String} name Name part of an address
 * @returns {String} Mime word encoded string if needed
 */
/* eslint-disable node/no-deprecated-api */
/* eslint-disable no-control-regex */

function encodeAddressName(name) {
  if (!/^[\w ']*$/.test(name)) {
    if (/^[\x20-\x7e]*$/.test(name)) {
      return '"' + name.replace(/([\\"])/g, '\\$1') + '"';
    } else {
      return (0, _emailjsMimeCodec.mimeWordEncode)(name, 'Q');
    }
  }
  return name;
}

/**
 * Checks if a value is plaintext string (uses only printable 7bit chars)
 *
 * @param {String} value String to be tested
 * @returns {Boolean} true if it is a plaintext string
 */
function isPlainText(value) {
  return !(typeof value !== 'string' || /[\x00-\x08\x0b\x0c\x0e-\x1f\u0080-\uFFFF]/.test(value));
}

/**
 * Rebuilds address object using punycode and other adjustments
 *
 * @param {Array} addresses An array of address objects
 * @param {Array} [uniqueList] An array to be populated with addresses
 * @return {String} address string
 */
function convertAddresses() {
  var addresses = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var uniqueList = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  var values = [];[].concat(addresses).forEach(function (address) {
    if (address.address) {
      address.address = address.address.replace(/^.*?(?=@)/, function (user) {
        return (0, _emailjsMimeCodec.mimeWordsEncode)(user, 'Q');
      }).replace(/@.+$/, function (domain) {
        return '@' + (0, _punycode.toASCII)(domain.substr(1));
      });

      if (!address.name) {
        values.push(address.address);
      } else if (address.name) {
        values.push(encodeAddressName(address.name) + ' <' + address.address + '>');
      }

      if (uniqueList.indexOf(address.address) < 0) {
        uniqueList.push(address.address);
      }
    } else if (address.group) {
      values.push(encodeAddressName(address.name) + ':' + (address.group.length ? convertAddresses(address.group, uniqueList) : '').trim() + ';');
    }
  });

  return values.join(', ');
}

/**
 * Parses addresses. Takes in a single address or an array or an
 * array of address arrays (eg. To: [[first group], [second group],...])
 *
 * @param {Mixed} addresses Addresses to be parsed
 * @return {Array} An array of address objects
 */
function parseAddresses() {
  var addresses = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

  return (0, _ramda.flatten)([].concat(addresses).map(function (address) {
    if (address && address.address) {
      address = convertAddresses(address);
    }
    return (0, _emailjsAddressparser2.default)(address);
  }));
}

/**
 * Encodes a header value for use in the generated rfc2822 email.
 *
 * @param {String} key Header key
 * @param {String} value Header value
 */
function encodeHeaderValue(key) {
  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

  key = normalizeHeaderKey(key);

  switch (key) {
    case 'From':
    case 'Sender':
    case 'To':
    case 'Cc':
    case 'Bcc':
    case 'Reply-To':
      return convertAddresses(parseAddresses(value));

    case 'Message-Id':
    case 'In-Reply-To':
    case 'Content-Id':
      value = value.replace(/\r?\n|\r/g, ' ');

      if (value.charAt(0) !== '<') {
        value = '<' + value;
      }

      if (value.charAt(value.length - 1) !== '>') {
        value = value + '>';
      }
      return value;

    case 'References':
      value = [].concat.apply([], [].concat(value).map(function () {
        var elm = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
        return elm.replace(/\r?\n|\r/g, ' ').trim().replace(/<[^>]*>/g, function (str) {
          return str.replace(/\s/g, '');
        }).split(/\s+/);
      })).map(function (elm) {
        if (elm.charAt(0) !== '<') {
          elm = '<' + elm;
        }
        if (elm.charAt(elm.length - 1) !== '>') {
          elm = elm + '>';
        }
        return elm;
      });

      return value.join(' ').trim();

    default:
      return (0, _emailjsMimeCodec.mimeWordsEncode)((value || '').toString().replace(/\r?\n|\r/g, ' '), 'B');
  }
}

/**
 * Normalizes a header key, uses Camel-Case form, except for uppercase MIME-
 *
 * @param {String} key Key to be normalized
 * @return {String} key in Camel-Case form
 */
function normalizeHeaderKey() {
  var key = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

  return key.replace(/\r?\n|\r/g, ' ') // no newlines in keys
  .trim().toLowerCase().replace(/^MIME\b|^[a-z]|-[a-z]/ig, function (c) {
    return c.toUpperCase();
  }); // use uppercase words, except MIME
}

/**
 * Generates a multipart boundary value
 *
 * @return {String} boundary value
 */
function generateBoundary(nodeId, baseBoundary) {
  return '----sinikael-?=_' + nodeId + '-' + baseBoundary;
}

/**
 * Escapes a header argument value (eg. boundary value for content type),
 * adds surrounding quotes if needed
 *
 * @param {String} value Header argument value
 * @return {String} escaped and quoted (if needed) argument value
 */
function escapeHeaderArgument(value) {
  if (value.match(/[\s'"\\;/=]|^-/g)) {
    return '"' + value.replace(/(["\\])/g, '\\$1') + '"';
  } else {
    return value;
  }
}

/**
 * Joins parsed header value together as 'value; param1=value1; param2=value2'
 *
 * @param {Object} structured Parsed header value
 * @return {String} joined header value
 */
function buildHeaderValue(structured) {
  var paramsArray = [];

  Object.keys(structured.params || {}).forEach(function (param) {
    // filename might include unicode characters so it is a special case
    if (param === 'filename') {
      (0, _emailjsMimeCodec.continuationEncode)(param, structured.params[param], 50).forEach(function (encodedParam) {
        // continuation encoded strings are always escaped, so no need to use enclosing quotes
        // in fact using quotes might end up with invalid filenames in some clients
        paramsArray.push(encodedParam.key + '=' + encodedParam.value);
      });
    } else {
      paramsArray.push(param + '=' + escapeHeaderArgument(structured.params[param]));
    }
  });

  return structured.value + (paramsArray.length ? '; ' + paramsArray.join('; ') : '');
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlscy5qcyJdLCJuYW1lcyI6WyJpc1BsYWluVGV4dCIsImNvbnZlcnRBZGRyZXNzZXMiLCJwYXJzZUFkZHJlc3NlcyIsImVuY29kZUhlYWRlclZhbHVlIiwibm9ybWFsaXplSGVhZGVyS2V5IiwiZ2VuZXJhdGVCb3VuZGFyeSIsImVzY2FwZUhlYWRlckFyZ3VtZW50IiwiYnVpbGRIZWFkZXJWYWx1ZSIsImVuY29kZUFkZHJlc3NOYW1lIiwibmFtZSIsInRlc3QiLCJyZXBsYWNlIiwidmFsdWUiLCJhZGRyZXNzZXMiLCJ1bmlxdWVMaXN0IiwidmFsdWVzIiwiY29uY2F0IiwiZm9yRWFjaCIsImFkZHJlc3MiLCJ1c2VyIiwiZG9tYWluIiwic3Vic3RyIiwicHVzaCIsImluZGV4T2YiLCJncm91cCIsImxlbmd0aCIsInRyaW0iLCJqb2luIiwibWFwIiwia2V5IiwiY2hhckF0IiwiYXBwbHkiLCJlbG0iLCJzdHIiLCJzcGxpdCIsInRvU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJjIiwidG9VcHBlckNhc2UiLCJub2RlSWQiLCJiYXNlQm91bmRhcnkiLCJtYXRjaCIsInN0cnVjdHVyZWQiLCJwYXJhbXNBcnJheSIsIk9iamVjdCIsImtleXMiLCJwYXJhbXMiLCJwYXJhbSIsImVuY29kZWRQYXJhbSJdLCJtYXBwaW5ncyI6Ijs7Ozs7UUFtQ2dCQSxXLEdBQUFBLFc7UUFXQUMsZ0IsR0FBQUEsZ0I7UUFpQ0FDLGMsR0FBQUEsYztRQWVBQyxpQixHQUFBQSxpQjtRQXVEQUMsa0IsR0FBQUEsa0I7UUFXQUMsZ0IsR0FBQUEsZ0I7UUFXQUMsb0IsR0FBQUEsb0I7UUFjQUMsZ0IsR0FBQUEsZ0I7O0FBdExoQjs7QUFDQTs7OztBQUNBOztBQUtBOzs7O0FBRUE7Ozs7OztBQVpBO0FBQ0E7O0FBaUJBLFNBQVNDLGlCQUFULENBQTRCQyxJQUE1QixFQUFrQztBQUNoQyxNQUFJLENBQUMsWUFBWUMsSUFBWixDQUFpQkQsSUFBakIsQ0FBTCxFQUE2QjtBQUMzQixR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O0FBQ0EsUUFBSThCLFVBQVUsVUFBZCxFQUEwQjtBQUN4QixnREFBbUJBLEtBQW5CLEVBQTBCTCxXQUFXSSxNQUFYLENBQWtCQyxLQUFsQixDQUExQixFQUFvRCxFQUFwRCxFQUF3RDlCLE9BQXhELENBQWdFLFVBQVUrQixZQUFWLEVBQXdCO0FBQ3RGO0FBQ0E7QUFDQUwsb0JBQVlyQixJQUFaLENBQWlCMEIsYUFBYW5CLEdBQWIsR0FBbUIsR0FBbkIsR0FBeUJtQixhQUFhcEMsS0FBdkQ7QUFDRCxPQUpEO0FBS0QsS0FORCxNQU1PO0FBQ0wrQixrQkFBWXJCLElBQVosQ0FBaUJ5QixRQUFRLEdBQVIsR0FBY3pDLHFCQUFxQm9DLFdBQVdJLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXJCLENBQS9CO0FBQ0Q7QUFDRixHQVhEOztBQWFBLFNBQU9MLFdBQVc5QixLQUFYLElBQW9CK0IsWUFBWWxCLE1BQVosR0FBcUIsT0FBT2tCLFlBQVloQixJQUFaLENBQWlCLElBQWpCLENBQTVCLEdBQXFELEVBQXpFLENBQVA7QUFDRCIsImZpbGUiOiJ1dGlscy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGVzbGludC1kaXNhYmxlIG5vZGUvbm8tZGVwcmVjYXRlZC1hcGkgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnRyb2wtcmVnZXggKi9cblxuaW1wb3J0IHsgZmxhdHRlbiB9IGZyb20gJ3JhbWRhJ1xuaW1wb3J0IHBhcnNlQWRkcmVzcyBmcm9tICdlbWFpbGpzLWFkZHJlc3NwYXJzZXInXG5pbXBvcnQge1xuICBtaW1lV29yZHNFbmNvZGUsXG4gIG1pbWVXb3JkRW5jb2RlLFxuICBjb250aW51YXRpb25FbmNvZGVcbn0gZnJvbSAnZW1haWxqcy1taW1lLWNvZGVjJ1xuaW1wb3J0IHsgdG9BU0NJSSB9IGZyb20gJ3B1bnljb2RlJ1xuXG4vKipcbiAqIElmIG5lZWRlZCwgbWltZSBlbmNvZGVzIHRoZSBuYW1lIHBhcnRcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIHBhcnQgb2YgYW4gYWRkcmVzc1xuICogQHJldHVybnMge1N0cmluZ30gTWltZSB3b3JkIGVuY29kZWQgc3RyaW5nIGlmIG5lZWRlZFxuICovXG5mdW5jdGlvbiBlbmNvZGVBZGRyZXNzTmFtZSAobmFtZSkge1xuICBpZiAoIS9eW1xcdyAnXSokLy50ZXN0KG5hbWUpKSB7XG4gICAgaWYgKC9eW1xceDIwLVxceDdlXSokLy50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gJ1wiJyArIG5hbWUucmVwbGFjZSgvKFtcXFxcXCJdKS9nLCAnXFxcXCQxJykgKyAnXCInXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBtaW1lV29yZEVuY29kZShuYW1lLCAnUScpXG4gICAgfVxuICB9XG4gIHJldHVybiBuYW1lXG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGEgdmFsdWUgaXMgcGxhaW50ZXh0IHN0cmluZyAodXNlcyBvbmx5IHByaW50YWJsZSA3Yml0IGNoYXJzKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBTdHJpbmcgdG8gYmUgdGVzdGVkXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBpZiBpdCBpcyBhIHBsYWludGV4dCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUGxhaW5UZXh0ICh2YWx1ZSkge1xuICByZXR1cm4gISh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnIHx8IC9bXFx4MDAtXFx4MDhcXHgwYlxceDBjXFx4MGUtXFx4MWZcXHUwMDgwLVxcdUZGRkZdLy50ZXN0KHZhbHVlKSlcbn1cblxuLyoqXG4gKiBSZWJ1aWxkcyBhZGRyZXNzIG9iamVjdCB1c2luZyBwdW55Y29kZSBhbmQgb3RoZXIgYWRqdXN0bWVudHNcbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBhZGRyZXNzZXMgQW4gYXJyYXkgb2YgYWRkcmVzcyBvYmplY3RzXG4gKiBAcGFyYW0ge0FycmF5fSBbdW5pcXVlTGlzdF0gQW4gYXJyYXkgdG8gYmUgcG9wdWxhdGVkIHdpdGggYWRkcmVzc2VzXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGFkZHJlc3Mgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0QWRkcmVzc2VzIChhZGRyZXNzZXMgPSBbXSwgdW5pcXVlTGlzdCA9IFtdKSB7XG4gIHZhciB2YWx1ZXMgPSBbXVxuXG4gIDtbXS5jb25jYXQoYWRkcmVzc2VzKS5mb3JFYWNoKGFkZHJlc3MgPT4ge1xuICAgIGlmIChhZGRyZXNzLmFkZHJlc3MpIHtcbiAgICAgIGFkZHJlc3MuYWRkcmVzcyA9IGFkZHJlc3MuYWRkcmVzc1xuICAgICAgICAucmVwbGFjZSgvXi4qPyg/PUApLywgdXNlciA9PiBtaW1lV29yZHNFbmNvZGUodXNlciwgJ1EnKSlcbiAgICAgICAgLnJlcGxhY2UoL0AuKyQvLCBkb21haW4gPT4gJ0AnICsgdG9BU0NJSShkb21haW4uc3Vic3RyKDEpKSlcblxuICAgICAgaWYgKCFhZGRyZXNzLm5hbWUpIHtcbiAgICAgICAgdmFsdWVzLnB1c2goYWRkcmVzcy5hZGRyZXNzKVxuICAgICAgfSBlbHNlIGlmIChhZGRyZXNzLm5hbWUpIHtcbiAgICAgICAgdmFsdWVzLnB1c2goZW5jb2RlQWRkcmVzc05hbWUoYWRkcmVzcy5uYW1lKSArICcgPCcgKyBhZGRyZXNzLmFkZHJlc3MgKyAnPicpXG4gICAgICB9XG5cbiAgICAgIGlmICh1bmlxdWVMaXN0LmluZGV4T2YoYWRkcmVzcy5hZGRyZXNzKSA8IDApIHtcbiAgICAgICAgdW5pcXVlTGlzdC5wdXNoKGFkZHJlc3MuYWRkcmVzcylcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFkZHJlc3MuZ3JvdXApIHtcbiAgICAgIHZhbHVlcy5wdXNoKGVuY29kZUFkZHJlc3NOYW1lKGFkZHJlc3MubmFtZSkgKyAnOicgKyAoYWRkcmVzcy5ncm91cC5sZW5ndGggPyBjb252ZXJ0QWRkcmVzc2VzKGFkZHJlc3MuZ3JvdXAsIHVuaXF1ZUxpc3QpIDogJycpLnRyaW0oKSArICc7JylcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHZhbHVlcy5qb2luKCcsICcpXG59XG5cbi8qKlxuICogUGFyc2VzIGFkZHJlc3Nlcy4gVGFrZXMgaW4gYSBzaW5nbGUgYWRkcmVzcyBvciBhbiBhcnJheSBvciBhblxuICogYXJyYXkgb2YgYWRkcmVzcyBhcnJheXMgKGVnLiBUbzogW1tmaXJzdCBncm91cF0sIFtzZWNvbmQgZ3JvdXBdLC4uLl0pXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gYWRkcmVzc2VzIEFkZHJlc3NlcyB0byBiZSBwYXJzZWRcbiAqIEByZXR1cm4ge0FycmF5fSBBbiBhcnJheSBvZiBhZGRyZXNzIG9iamVjdHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQWRkcmVzc2VzIChhZGRyZXNzZXMgPSBbXSkge1xuICByZXR1cm4gZmxhdHRlbihbXS5jb25jYXQoYWRkcmVzc2VzKS5tYXAoKGFkZHJlc3MpID0+IHtcbiAgICBpZiAoYWRkcmVzcyAmJiBhZGRyZXNzLmFkZHJlc3MpIHtcbiAgICAgIGFkZHJlc3MgPSBjb252ZXJ0QWRkcmVzc2VzKGFkZHJlc3MpXG4gICAgfVxuICAgIHJldHVybiBwYXJzZUFkZHJlc3MoYWRkcmVzcylcbiAgfSkpXG59XG5cbi8qKlxuICogRW5jb2RlcyBhIGhlYWRlciB2YWx1ZSBmb3IgdXNlIGluIHRoZSBnZW5lcmF0ZWQgcmZjMjgyMiBlbWFpbC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5IEhlYWRlciBrZXlcbiAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBIZWFkZXIgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuY29kZUhlYWRlclZhbHVlIChrZXksIHZhbHVlID0gJycpIHtcbiAga2V5ID0gbm9ybWFsaXplSGVhZGVyS2V5KGtleSlcblxuICBzd2l0Y2ggKGtleSkge1xuICAgIGNhc2UgJ0Zyb20nOlxuICAgIGNhc2UgJ1NlbmRlcic6XG4gICAgY2FzZSAnVG8nOlxuICAgIGNhc2UgJ0NjJzpcbiAgICBjYXNlICdCY2MnOlxuICAgIGNhc2UgJ1JlcGx5LVRvJzpcbiAgICAgIHJldHVybiBjb252ZXJ0QWRkcmVzc2VzKHBhcnNlQWRkcmVzc2VzKHZhbHVlKSlcblxuICAgIGNhc2UgJ01lc3NhZ2UtSWQnOlxuICAgIGNhc2UgJ0luLVJlcGx5LVRvJzpcbiAgICBjYXNlICdDb250ZW50LUlkJzpcbiAgICAgIHZhbHVlID0gdmFsdWUucmVwbGFjZSgvXFxyP1xcbnxcXHIvZywgJyAnKVxuXG4gICAgICBpZiAodmFsdWUuY2hhckF0KDApICE9PSAnPCcpIHtcbiAgICAgICAgdmFsdWUgPSAnPCcgKyB2YWx1ZVxuICAgICAgfVxuXG4gICAgICBpZiAodmFsdWUuY2hhckF0KHZhbHVlLmxlbmd0aCAtIDEpICE9PSAnPicpIHtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZSArICc+J1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlXG5cbiAgICBjYXNlICdSZWZlcmVuY2VzJzpcbiAgICAgIHZhbHVlID0gW10uY29uY2F0LmFwcGx5KFtdLCBbXS5jb25jYXQodmFsdWUpLm1hcCgoZWxtID0gJycpID0+IGVsbVxuICAgICAgICAucmVwbGFjZSgvXFxyP1xcbnxcXHIvZywgJyAnKVxuICAgICAgICAudHJpbSgpXG4gICAgICAgIC5yZXBsYWNlKC88W14+XSo+L2csIHN0ciA9PiBzdHIucmVwbGFjZSgvXFxzL2csICcnKSlcbiAgICAgICAgLnNwbGl0KC9cXHMrLylcbiAgICAgICkpLm1hcChmdW5jdGlvbiAoZWxtKSB7XG4gICAgICAgIGlmIChlbG0uY2hhckF0KDApICE9PSAnPCcpIHtcbiAgICAgICAgICBlbG0gPSAnPCcgKyBlbG1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZWxtLmNoYXJBdChlbG0ubGVuZ3RoIC0gMSkgIT09ICc+Jykge1xuICAgICAgICAgIGVsbSA9IGVsbSArICc+J1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBlbG1cbiAgICAgIH0pXG5cbiAgICAgIHJldHVybiB2YWx1ZS5qb2luKCcgJykudHJpbSgpXG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG1pbWVXb3Jkc0VuY29kZSgodmFsdWUgfHwgJycpLnRvU3RyaW5nKCkucmVwbGFjZSgvXFxyP1xcbnxcXHIvZywgJyAnKSwgJ0InKVxuICB9XG59XG5cbi8qKlxuICogTm9ybWFsaXplcyBhIGhlYWRlciBrZXksIHVzZXMgQ2FtZWwtQ2FzZSBmb3JtLCBleGNlcHQgZm9yIHVwcGVyY2FzZSBNSU1FLVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgS2V5IHRvIGJlIG5vcm1hbGl6ZWRcbiAqIEByZXR1cm4ge1N0cmluZ30ga2V5IGluIENhbWVsLUNhc2UgZm9ybVxuICovXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplSGVhZGVyS2V5IChrZXkgPSAnJykge1xuICByZXR1cm4ga2V5LnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJykgLy8gbm8gbmV3bGluZXMgaW4ga2V5c1xuICAgIC50cmltKCkudG9Mb3dlckNhc2UoKVxuICAgIC5yZXBsYWNlKC9eTUlNRVxcYnxeW2Etel18LVthLXpdL2lnLCBjID0+IGMudG9VcHBlckNhc2UoKSkgLy8gdXNlIHVwcGVyY2FzZSB3b3JkcywgZXhjZXB0IE1JTUVcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgYSBtdWx0aXBhcnQgYm91bmRhcnkgdmFsdWVcbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGJvdW5kYXJ5IHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUJvdW5kYXJ5IChub2RlSWQsIGJhc2VCb3VuZGFyeSkge1xuICByZXR1cm4gJy0tLS1zaW5pa2FlbC0/PV8nICsgbm9kZUlkICsgJy0nICsgYmFzZUJvdW5kYXJ5XG59XG5cbi8qKlxuICogRXNjYXBlcyBhIGhlYWRlciBhcmd1bWVudCB2YWx1ZSAoZWcuIGJvdW5kYXJ5IHZhbHVlIGZvciBjb250ZW50IHR5cGUpLFxuICogYWRkcyBzdXJyb3VuZGluZyBxdW90ZXMgaWYgbmVlZGVkXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIEhlYWRlciBhcmd1bWVudCB2YWx1ZVxuICogQHJldHVybiB7U3RyaW5nfSBlc2NhcGVkIGFuZCBxdW90ZWQgKGlmIG5lZWRlZCkgYXJndW1lbnQgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZUhlYWRlckFyZ3VtZW50ICh2YWx1ZSkge1xuICBpZiAodmFsdWUubWF0Y2goL1tcXHMnXCJcXFxcOy89XXxeLS9nKSkge1xuICAgIHJldHVybiAnXCInICsgdmFsdWUucmVwbGFjZSgvKFtcIlxcXFxdKS9nLCAnXFxcXCQxJykgKyAnXCInXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHZhbHVlXG4gIH1cbn1cblxuLyoqXG4gKiBKb2lucyBwYXJzZWQgaGVhZGVyIHZhbHVlIHRvZ2V0aGVyIGFzICd2YWx1ZTsgcGFyYW0xPXZhbHVlMTsgcGFyYW0yPXZhbHVlMidcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gc3RydWN0dXJlZCBQYXJzZWQgaGVhZGVyIHZhbHVlXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGpvaW5lZCBoZWFkZXIgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkSGVhZGVyVmFsdWUgKHN0cnVjdHVyZWQpIHtcbiAgdmFyIHBhcmFtc0FycmF5ID0gW11cblxuICBPYmplY3Qua2V5cyhzdHJ1Y3R1cmVkLnBhcmFtcyB8fCB7fSkuZm9yRWFjaChwYXJhbSA9PiB7XG4gICAgLy8gZmlsZW5hbWUgbWlnaHQgaW5jbHVkZSB1bmljb2RlIGNoYXJhY3RlcnMgc28gaXQgaXMgYSBzcGVjaWFsIGNhc2VcbiAgICBpZiAocGFyYW0gPT09ICdmaWxlbmFtZScpIHtcbiAgICAgIGNvbnRpbnVhdGlvbkVuY29kZShwYXJhbSwgc3RydWN0dXJlZC5wYXJhbXNbcGFyYW1dLCA1MCkuZm9yRWFjaChmdW5jdGlvbiAoZW5jb2RlZFBhcmFtKSB7XG4gICAgICAgIC8vIGNvbnRpbnVhdGlvbiBlbmNvZGVkIHN0cmluZ3MgYXJlIGFsd2F5cyBlc2NhcGVkLCBzbyBubyBuZWVkIHRvIHVzZSBlbmNsb3NpbmcgcXVvdGVzXG4gICAgICAgIC8vIGluIGZhY3QgdXNpbmcgcXVvdGVzIG1pZ2h0IGVuZCB1cCB3aXRoIGludmFsaWQgZmlsZW5hbWVzIGluIHNvbWUgY2xpZW50c1xuICAgICAgICBwYXJhbXNBcnJheS5wdXNoKGVuY29kZWRQYXJhbS5rZXkgKyAnPScgKyBlbmNvZGVkUGFyYW0udmFsdWUpXG4gICAgICB9KVxuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXNBcnJheS5wdXNoKHBhcmFtICsgJz0nICsgZXNjYXBlSGVhZGVyQXJndW1lbnQoc3RydWN0dXJlZC5wYXJhbXNbcGFyYW1dKSlcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHN0cnVjdHVyZWQudmFsdWUgKyAocGFyYW1zQXJyYXkubGVuZ3RoID8gJzsgJyArIHBhcmFtc0FycmF5LmpvaW4oJzsgJykgOiAnJylcbn1cbiJdfQ==
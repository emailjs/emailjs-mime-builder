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
      return (0, _emailjsMimeCodec.mimeWordEncode)(name, 'Q', 52);
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

  // console.log(addresses)
  // console.log(uniqueList)
  var values = [];[].concat(addresses).forEach(function (address) {
    if (address.address) {
      address.address = address.address.replace(/^.*?(?=@)/, function (user) {
        return (0, _emailjsMimeCodec.mimeWordsEncode)(user, 'Q', 52);
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
      value = (value || '').toString().replace(/\r?\n|\r/g, ' ');
      // mimeWordsEncode only encodes if needed, otherwise the original string is returned
      return (0, _emailjsMimeCodec.mimeWordsEncode)(value, 'Q');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlscy5qcyJdLCJuYW1lcyI6WyJpc1BsYWluVGV4dCIsImNvbnZlcnRBZGRyZXNzZXMiLCJwYXJzZUFkZHJlc3NlcyIsImVuY29kZUhlYWRlclZhbHVlIiwibm9ybWFsaXplSGVhZGVyS2V5IiwiZ2VuZXJhdGVCb3VuZGFyeSIsImVzY2FwZUhlYWRlckFyZ3VtZW50IiwiYnVpbGRIZWFkZXJWYWx1ZSIsImVuY29kZUFkZHJlc3NOYW1lIiwibmFtZSIsInRlc3QiLCJyZXBsYWNlIiwidmFsdWUiLCJhZGRyZXNzZXMiLCJ1bmlxdWVMaXN0IiwidmFsdWVzIiwiY29uY2F0IiwiZm9yRWFjaCIsImFkZHJlc3MiLCJ1c2VyIiwiZG9tYWluIiwic3Vic3RyIiwicHVzaCIsImluZGV4T2YiLCJncm91cCIsImxlbmd0aCIsInRyaW0iLCJqb2luIiwibWFwIiwia2V5IiwiY2hhckF0IiwiYXBwbHkiLCJlbG0iLCJzdHIiLCJzcGxpdCIsInRvU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJjIiwidG9VcHBlckNhc2UiLCJub2RlSWQiLCJiYXNlQm91bmRhcnkiLCJtYXRjaCIsInN0cnVjdHVyZWQiLCJwYXJhbXNBcnJheSIsIk9iamVjdCIsImtleXMiLCJwYXJhbXMiLCJwYXJhbSIsImVuY29kZWRQYXJhbSJdLCJtYXBwaW5ncyI6Ijs7Ozs7UUFtQ2dCQSxXLEdBQUFBLFc7UUFXQUMsZ0IsR0FBQUEsZ0I7UUFtQ0FDLGMsR0FBQUEsYztRQWVBQyxpQixHQUFBQSxpQjtRQXlEQUMsa0IsR0FBQUEsa0I7UUFXQUMsZ0IsR0FBQUEsZ0I7UUFXQUMsb0IsR0FBQUEsb0I7UUFjQUMsZ0IsR0FBQUEsZ0I7O0FBMUxoQjs7QUFDQTs7OztBQUNBOztBQUtBOzs7O0FBRUE7Ozs7OztBQVpBO0FBQ0E7O0FBaUJBLFNBQVNDLGlCQUFULENBQTRCQyxJQUE1QixFQUFrQztBQUNoQyxNQUFJLENBQUMsWUFBWUMsSUFBWixDQUFpQkQsSUFBakIsQ0FBTCxFQUE2QjtBQUMzQixR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SCxXQUFXSSxNQUFYLElBQXFCLEVBQWpDLEVBQXFDN0IsT0FBckMsQ0FBNkMsaUJBQVM7QUFDcEQ7QUFDQSxRQUFJOEIsVUFBVSxVQUFkLEVBQTBCO0FBQ3hCLGdEQUFtQkEsS0FBbkIsRUFBMEJMLFdBQVdJLE1BQVgsQ0FBa0JDLEtBQWxCLENBQTFCLEVBQW9ELEVBQXBELEVBQXdEOUIsT0FBeEQsQ0FBZ0UsVUFBVStCLFlBQVYsRUFBd0I7QUFDdEY7QUFDQTtBQUNBTCxvQkFBWXJCLElBQVosQ0FBaUIwQixhQUFhbkIsR0FBYixHQUFtQixHQUFuQixHQUF5Qm1CLGFBQWFwQyxLQUF2RDtBQUNELE9BSkQ7QUFLRCxLQU5ELE1BTU87QUFDTCtCLGtCQUFZckIsSUFBWixDQUFpQnlCLFFBQVEsR0FBUixHQUFjekMscUJBQXFCb0MsV0FBV0ksTUFBWCxDQUFrQkMsS0FBbEIsQ0FBckIsQ0FBL0I7QUFDRDtBQUNGLEdBWEQ7O0FBYUEsU0FBT0wsV0FBVzlCLEtBQVgsSUFBb0IrQixZQUFZbEIsTUFBWixHQUFxQixPQUFPa0IsWUFBWWhCLElBQVosQ0FBaUIsSUFBakIsQ0FBNUIsR0FBcUQsRUFBekUsQ0FBUDtBQUNEIiwiZmlsZSI6InV0aWxzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogZXNsaW50LWRpc2FibGUgbm9kZS9uby1kZXByZWNhdGVkLWFwaSAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tY29udHJvbC1yZWdleCAqL1xuXG5pbXBvcnQgeyBmbGF0dGVuIH0gZnJvbSAncmFtZGEnXG5pbXBvcnQgcGFyc2VBZGRyZXNzIGZyb20gJ2VtYWlsanMtYWRkcmVzc3BhcnNlcidcbmltcG9ydCB7XG4gIG1pbWVXb3Jkc0VuY29kZSxcbiAgbWltZVdvcmRFbmNvZGUsXG4gIGNvbnRpbnVhdGlvbkVuY29kZVxufSBmcm9tICdlbWFpbGpzLW1pbWUtY29kZWMnXG5pbXBvcnQgeyB0b0FTQ0lJIH0gZnJvbSAncHVueWNvZGUnXG5cbi8qKlxuICogSWYgbmVlZGVkLCBtaW1lIGVuY29kZXMgdGhlIG5hbWUgcGFydFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgcGFydCBvZiBhbiBhZGRyZXNzXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBNaW1lIHdvcmQgZW5jb2RlZCBzdHJpbmcgaWYgbmVlZGVkXG4gKi9cbmZ1bmN0aW9uIGVuY29kZUFkZHJlc3NOYW1lIChuYW1lKSB7XG4gIGlmICghL15bXFx3ICddKiQvLnRlc3QobmFtZSkpIHtcbiAgICBpZiAoL15bXFx4MjAtXFx4N2VdKiQvLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldHVybiAnXCInICsgbmFtZS5yZXBsYWNlKC8oW1xcXFxcIl0pL2csICdcXFxcJDEnKSArICdcIidcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG1pbWVXb3JkRW5jb2RlKG5hbWUsICdRJywgNTIpXG4gICAgfVxuICB9XG4gIHJldHVybiBuYW1lXG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGEgdmFsdWUgaXMgcGxhaW50ZXh0IHN0cmluZyAodXNlcyBvbmx5IHByaW50YWJsZSA3Yml0IGNoYXJzKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBTdHJpbmcgdG8gYmUgdGVzdGVkXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBpZiBpdCBpcyBhIHBsYWludGV4dCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUGxhaW5UZXh0ICh2YWx1ZSkge1xuICByZXR1cm4gISh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnIHx8IC9bXFx4MDAtXFx4MDhcXHgwYlxceDBjXFx4MGUtXFx4MWZcXHUwMDgwLVxcdUZGRkZdLy50ZXN0KHZhbHVlKSlcbn1cblxuLyoqXG4gKiBSZWJ1aWxkcyBhZGRyZXNzIG9iamVjdCB1c2luZyBwdW55Y29kZSBhbmQgb3RoZXIgYWRqdXN0bWVudHNcbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBhZGRyZXNzZXMgQW4gYXJyYXkgb2YgYWRkcmVzcyBvYmplY3RzXG4gKiBAcGFyYW0ge0FycmF5fSBbdW5pcXVlTGlzdF0gQW4gYXJyYXkgdG8gYmUgcG9wdWxhdGVkIHdpdGggYWRkcmVzc2VzXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGFkZHJlc3Mgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0QWRkcmVzc2VzIChhZGRyZXNzZXMgPSBbXSwgdW5pcXVlTGlzdCA9IFtdKSB7XG4gIC8vIGNvbnNvbGUubG9nKGFkZHJlc3NlcylcbiAgLy8gY29uc29sZS5sb2codW5pcXVlTGlzdClcbiAgdmFyIHZhbHVlcyA9IFtdXG5cbiAgO1tdLmNvbmNhdChhZGRyZXNzZXMpLmZvckVhY2goYWRkcmVzcyA9PiB7XG4gICAgaWYgKGFkZHJlc3MuYWRkcmVzcykge1xuICAgICAgYWRkcmVzcy5hZGRyZXNzID0gYWRkcmVzcy5hZGRyZXNzXG4gICAgICAgIC5yZXBsYWNlKC9eLio/KD89QCkvLCB1c2VyID0+IG1pbWVXb3Jkc0VuY29kZSh1c2VyLCAnUScsIDUyKSlcbiAgICAgICAgLnJlcGxhY2UoL0AuKyQvLCBkb21haW4gPT4gJ0AnICsgdG9BU0NJSShkb21haW4uc3Vic3RyKDEpKSlcblxuICAgICAgaWYgKCFhZGRyZXNzLm5hbWUpIHtcbiAgICAgICAgdmFsdWVzLnB1c2goYWRkcmVzcy5hZGRyZXNzKVxuICAgICAgfSBlbHNlIGlmIChhZGRyZXNzLm5hbWUpIHtcbiAgICAgICAgdmFsdWVzLnB1c2goZW5jb2RlQWRkcmVzc05hbWUoYWRkcmVzcy5uYW1lKSArICcgPCcgKyBhZGRyZXNzLmFkZHJlc3MgKyAnPicpXG4gICAgICB9XG5cbiAgICAgIGlmICh1bmlxdWVMaXN0LmluZGV4T2YoYWRkcmVzcy5hZGRyZXNzKSA8IDApIHtcbiAgICAgICAgdW5pcXVlTGlzdC5wdXNoKGFkZHJlc3MuYWRkcmVzcylcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFkZHJlc3MuZ3JvdXApIHtcbiAgICAgIHZhbHVlcy5wdXNoKGVuY29kZUFkZHJlc3NOYW1lKGFkZHJlc3MubmFtZSkgKyAnOicgKyAoYWRkcmVzcy5ncm91cC5sZW5ndGggPyBjb252ZXJ0QWRkcmVzc2VzKGFkZHJlc3MuZ3JvdXAsIHVuaXF1ZUxpc3QpIDogJycpLnRyaW0oKSArICc7JylcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHZhbHVlcy5qb2luKCcsICcpXG59XG5cbi8qKlxuICogUGFyc2VzIGFkZHJlc3Nlcy4gVGFrZXMgaW4gYSBzaW5nbGUgYWRkcmVzcyBvciBhbiBhcnJheSBvciBhblxuICogYXJyYXkgb2YgYWRkcmVzcyBhcnJheXMgKGVnLiBUbzogW1tmaXJzdCBncm91cF0sIFtzZWNvbmQgZ3JvdXBdLC4uLl0pXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gYWRkcmVzc2VzIEFkZHJlc3NlcyB0byBiZSBwYXJzZWRcbiAqIEByZXR1cm4ge0FycmF5fSBBbiBhcnJheSBvZiBhZGRyZXNzIG9iamVjdHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQWRkcmVzc2VzIChhZGRyZXNzZXMgPSBbXSkge1xuICByZXR1cm4gZmxhdHRlbihbXS5jb25jYXQoYWRkcmVzc2VzKS5tYXAoKGFkZHJlc3MpID0+IHtcbiAgICBpZiAoYWRkcmVzcyAmJiBhZGRyZXNzLmFkZHJlc3MpIHtcbiAgICAgIGFkZHJlc3MgPSBjb252ZXJ0QWRkcmVzc2VzKGFkZHJlc3MpXG4gICAgfVxuICAgIHJldHVybiBwYXJzZUFkZHJlc3MoYWRkcmVzcylcbiAgfSkpXG59XG5cbi8qKlxuICogRW5jb2RlcyBhIGhlYWRlciB2YWx1ZSBmb3IgdXNlIGluIHRoZSBnZW5lcmF0ZWQgcmZjMjgyMiBlbWFpbC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5IEhlYWRlciBrZXlcbiAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBIZWFkZXIgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuY29kZUhlYWRlclZhbHVlIChrZXksIHZhbHVlID0gJycpIHtcbiAga2V5ID0gbm9ybWFsaXplSGVhZGVyS2V5KGtleSlcblxuICBzd2l0Y2ggKGtleSkge1xuICAgIGNhc2UgJ0Zyb20nOlxuICAgIGNhc2UgJ1NlbmRlcic6XG4gICAgY2FzZSAnVG8nOlxuICAgIGNhc2UgJ0NjJzpcbiAgICBjYXNlICdCY2MnOlxuICAgIGNhc2UgJ1JlcGx5LVRvJzpcbiAgICAgIHJldHVybiBjb252ZXJ0QWRkcmVzc2VzKHBhcnNlQWRkcmVzc2VzKHZhbHVlKSlcblxuICAgIGNhc2UgJ01lc3NhZ2UtSWQnOlxuICAgIGNhc2UgJ0luLVJlcGx5LVRvJzpcbiAgICBjYXNlICdDb250ZW50LUlkJzpcbiAgICAgIHZhbHVlID0gdmFsdWUucmVwbGFjZSgvXFxyP1xcbnxcXHIvZywgJyAnKVxuXG4gICAgICBpZiAodmFsdWUuY2hhckF0KDApICE9PSAnPCcpIHtcbiAgICAgICAgdmFsdWUgPSAnPCcgKyB2YWx1ZVxuICAgICAgfVxuXG4gICAgICBpZiAodmFsdWUuY2hhckF0KHZhbHVlLmxlbmd0aCAtIDEpICE9PSAnPicpIHtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZSArICc+J1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlXG5cbiAgICBjYXNlICdSZWZlcmVuY2VzJzpcbiAgICAgIHZhbHVlID0gW10uY29uY2F0LmFwcGx5KFtdLCBbXS5jb25jYXQodmFsdWUpLm1hcCgoZWxtID0gJycpID0+IGVsbVxuICAgICAgICAucmVwbGFjZSgvXFxyP1xcbnxcXHIvZywgJyAnKVxuICAgICAgICAudHJpbSgpXG4gICAgICAgIC5yZXBsYWNlKC88W14+XSo+L2csIHN0ciA9PiBzdHIucmVwbGFjZSgvXFxzL2csICcnKSlcbiAgICAgICAgLnNwbGl0KC9cXHMrLylcbiAgICAgICkpLm1hcChmdW5jdGlvbiAoZWxtKSB7XG4gICAgICAgIGlmIChlbG0uY2hhckF0KDApICE9PSAnPCcpIHtcbiAgICAgICAgICBlbG0gPSAnPCcgKyBlbG1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZWxtLmNoYXJBdChlbG0ubGVuZ3RoIC0gMSkgIT09ICc+Jykge1xuICAgICAgICAgIGVsbSA9IGVsbSArICc+J1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBlbG1cbiAgICAgIH0pXG5cbiAgICAgIHJldHVybiB2YWx1ZS5qb2luKCcgJykudHJpbSgpXG5cbiAgICBkZWZhdWx0OlxuICAgICAgdmFsdWUgPSAodmFsdWUgfHwgJycpLnRvU3RyaW5nKCkucmVwbGFjZSgvXFxyP1xcbnxcXHIvZywgJyAnKVxuICAgICAgLy8gbWltZVdvcmRzRW5jb2RlIG9ubHkgZW5jb2RlcyBpZiBuZWVkZWQsIG90aGVyd2lzZSB0aGUgb3JpZ2luYWwgc3RyaW5nIGlzIHJldHVybmVkXG4gICAgICByZXR1cm4gbWltZVdvcmRzRW5jb2RlKHZhbHVlLCAnUScpXG4gIH1cbn1cblxuLyoqXG4gKiBOb3JtYWxpemVzIGEgaGVhZGVyIGtleSwgdXNlcyBDYW1lbC1DYXNlIGZvcm0sIGV4Y2VwdCBmb3IgdXBwZXJjYXNlIE1JTUUtXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleSBLZXkgdG8gYmUgbm9ybWFsaXplZFxuICogQHJldHVybiB7U3RyaW5nfSBrZXkgaW4gQ2FtZWwtQ2FzZSBmb3JtXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVIZWFkZXJLZXkgKGtleSA9ICcnKSB7XG4gIHJldHVybiBrZXkucmVwbGFjZSgvXFxyP1xcbnxcXHIvZywgJyAnKSAvLyBubyBuZXdsaW5lcyBpbiBrZXlzXG4gICAgLnRyaW0oKS50b0xvd2VyQ2FzZSgpXG4gICAgLnJlcGxhY2UoL15NSU1FXFxifF5bYS16XXwtW2Etel0vaWcsIGMgPT4gYy50b1VwcGVyQ2FzZSgpKSAvLyB1c2UgdXBwZXJjYXNlIHdvcmRzLCBleGNlcHQgTUlNRVxufVxuXG4vKipcbiAqIEdlbmVyYXRlcyBhIG11bHRpcGFydCBib3VuZGFyeSB2YWx1ZVxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gYm91bmRhcnkgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQm91bmRhcnkgKG5vZGVJZCwgYmFzZUJvdW5kYXJ5KSB7XG4gIHJldHVybiAnLS0tLXNpbmlrYWVsLT89XycgKyBub2RlSWQgKyAnLScgKyBiYXNlQm91bmRhcnlcbn1cblxuLyoqXG4gKiBFc2NhcGVzIGEgaGVhZGVyIGFyZ3VtZW50IHZhbHVlIChlZy4gYm91bmRhcnkgdmFsdWUgZm9yIGNvbnRlbnQgdHlwZSksXG4gKiBhZGRzIHN1cnJvdW5kaW5nIHF1b3RlcyBpZiBuZWVkZWRcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgSGVhZGVyIGFyZ3VtZW50IHZhbHVlXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGVzY2FwZWQgYW5kIHF1b3RlZCAoaWYgbmVlZGVkKSBhcmd1bWVudCB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlSGVhZGVyQXJndW1lbnQgKHZhbHVlKSB7XG4gIGlmICh2YWx1ZS5tYXRjaCgvW1xccydcIlxcXFw7Lz1dfF4tL2cpKSB7XG4gICAgcmV0dXJuICdcIicgKyB2YWx1ZS5yZXBsYWNlKC8oW1wiXFxcXF0pL2csICdcXFxcJDEnKSArICdcIidcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdmFsdWVcbiAgfVxufVxuXG4vKipcbiAqIEpvaW5zIHBhcnNlZCBoZWFkZXIgdmFsdWUgdG9nZXRoZXIgYXMgJ3ZhbHVlOyBwYXJhbTE9dmFsdWUxOyBwYXJhbTI9dmFsdWUyJ1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBzdHJ1Y3R1cmVkIFBhcnNlZCBoZWFkZXIgdmFsdWVcbiAqIEByZXR1cm4ge1N0cmluZ30gam9pbmVkIGhlYWRlciB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRIZWFkZXJWYWx1ZSAoc3RydWN0dXJlZCkge1xuICB2YXIgcGFyYW1zQXJyYXkgPSBbXVxuXG4gIE9iamVjdC5rZXlzKHN0cnVjdHVyZWQucGFyYW1zIHx8IHt9KS5mb3JFYWNoKHBhcmFtID0+IHtcbiAgICAvLyBmaWxlbmFtZSBtaWdodCBpbmNsdWRlIHVuaWNvZGUgY2hhcmFjdGVycyBzbyBpdCBpcyBhIHNwZWNpYWwgY2FzZVxuICAgIGlmIChwYXJhbSA9PT0gJ2ZpbGVuYW1lJykge1xuICAgICAgY29udGludWF0aW9uRW5jb2RlKHBhcmFtLCBzdHJ1Y3R1cmVkLnBhcmFtc1twYXJhbV0sIDUwKS5mb3JFYWNoKGZ1bmN0aW9uIChlbmNvZGVkUGFyYW0pIHtcbiAgICAgICAgLy8gY29udGludWF0aW9uIGVuY29kZWQgc3RyaW5ncyBhcmUgYWx3YXlzIGVzY2FwZWQsIHNvIG5vIG5lZWQgdG8gdXNlIGVuY2xvc2luZyBxdW90ZXNcbiAgICAgICAgLy8gaW4gZmFjdCB1c2luZyBxdW90ZXMgbWlnaHQgZW5kIHVwIHdpdGggaW52YWxpZCBmaWxlbmFtZXMgaW4gc29tZSBjbGllbnRzXG4gICAgICAgIHBhcmFtc0FycmF5LnB1c2goZW5jb2RlZFBhcmFtLmtleSArICc9JyArIGVuY29kZWRQYXJhbS52YWx1ZSlcbiAgICAgIH0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmFtc0FycmF5LnB1c2gocGFyYW0gKyAnPScgKyBlc2NhcGVIZWFkZXJBcmd1bWVudChzdHJ1Y3R1cmVkLnBhcmFtc1twYXJhbV0pKVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gc3RydWN0dXJlZC52YWx1ZSArIChwYXJhbXNBcnJheS5sZW5ndGggPyAnOyAnICsgcGFyYW1zQXJyYXkuam9pbignOyAnKSA6ICcnKVxufVxuIl19
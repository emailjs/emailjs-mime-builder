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

  // console.log(addresses)
  // console.log(uniqueList)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlscy5qcyJdLCJuYW1lcyI6WyJpc1BsYWluVGV4dCIsImNvbnZlcnRBZGRyZXNzZXMiLCJwYXJzZUFkZHJlc3NlcyIsImVuY29kZUhlYWRlclZhbHVlIiwibm9ybWFsaXplSGVhZGVyS2V5IiwiZ2VuZXJhdGVCb3VuZGFyeSIsImVzY2FwZUhlYWRlckFyZ3VtZW50IiwiYnVpbGRIZWFkZXJWYWx1ZSIsImVuY29kZUFkZHJlc3NOYW1lIiwibmFtZSIsInRlc3QiLCJyZXBsYWNlIiwidmFsdWUiLCJhZGRyZXNzZXMiLCJ1bmlxdWVMaXN0IiwidmFsdWVzIiwiY29uY2F0IiwiZm9yRWFjaCIsImFkZHJlc3MiLCJ1c2VyIiwiZG9tYWluIiwic3Vic3RyIiwicHVzaCIsImluZGV4T2YiLCJncm91cCIsImxlbmd0aCIsInRyaW0iLCJqb2luIiwibWFwIiwia2V5IiwiY2hhckF0IiwiYXBwbHkiLCJlbG0iLCJzdHIiLCJzcGxpdCIsInRvU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJjIiwidG9VcHBlckNhc2UiLCJub2RlSWQiLCJiYXNlQm91bmRhcnkiLCJtYXRjaCIsInN0cnVjdHVyZWQiLCJwYXJhbXNBcnJheSIsIk9iamVjdCIsImtleXMiLCJwYXJhbXMiLCJwYXJhbSIsImVuY29kZWRQYXJhbSJdLCJtYXBwaW5ncyI6Ijs7Ozs7UUFtQ2dCQSxXLEdBQUFBLFc7UUFXQUMsZ0IsR0FBQUEsZ0I7UUFtQ0FDLGMsR0FBQUEsYztRQWVBQyxpQixHQUFBQSxpQjtRQXlEQUMsa0IsR0FBQUEsa0I7UUFXQUMsZ0IsR0FBQUEsZ0I7UUFXQUMsb0IsR0FBQUEsb0I7UUFjQUMsZ0IsR0FBQUEsZ0I7O0FBMUxoQjs7QUFDQTs7OztBQUNBOztBQUtBOzs7O0FBRUE7Ozs7OztBQVpBO0FBQ0E7O0FBaUJBLFNBQVNDLGlCQUFULENBQTRCQyxJQUE1QixFQUFrQztBQUNoQyxNQUFJLENBQUMsWUFBWUMsSUFBWixDQUFpQkQsSUFBakIsQ0FBTCxFQUE2QjtBQUMzQixR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LEVBQXFDN0IsT0FBckMsQ0FBNkMsaUJBQVM7QUFDcEQ7QUFDQSxRQUFJOEIsVUFBVSxVQUFkLEVBQTBCO0FBQ3hCLGdEQUFtQkEsS0FBbkIsRUFBMEJMLFdBQVdJLE1BQVgsQ0FBa0JDLEtBQWxCLENBQTFCLEVBQW9ELEVBQXBELEVBQXdEOUIsT0FBeEQsQ0FBZ0UsVUFBVStCLFlBQVYsRUFBd0I7QUFDdEY7QUFDQTtBQUNBTCxvQkFBWXJCLElBQVosQ0FBaUIwQixhQUFhbkIsR0FBYixHQUFtQixHQUFuQixHQUF5Qm1CLGFBQWFwQyxLQUF2RDtBQUNELE9BSkQ7QUFLRCxLQU5ELE1BTU87QUFDTCtCLGtCQUFZckIsSUFBWixDQUFpQnlCLFFBQVEsR0FBUixHQUFjekMscUJBQXFCb0MsV0FBV0ksTUFBWCxDQUFrQkMsS0FBbEIsQ0FBckIsQ0FBL0I7QUFDRDtBQUNGLEdBWEQ7O0FBYUEsU0FBT0wsV0FBVzlCLEtBQVgsSUFBb0IrQixZQUFZbEIsTUFBWixHQUFxQixPQUFPa0IsWUFBWWhCLElBQVosQ0FBaUIsSUFBakIsQ0FBNUIsR0FBcUQsRUFBekUsQ0FBUDtBQUNEIiwiZmlsZSI6InV0aWxzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogZXNsaW50LWRpc2FibGUgbm9kZS9uby1kZXByZWNhdGVkLWFwaSAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tY29udHJvbC1yZWdleCAqL1xuXG5pbXBvcnQgeyBmbGF0dGVuIH0gZnJvbSAncmFtZGEnXG5pbXBvcnQgcGFyc2VBZGRyZXNzIGZyb20gJ2VtYWlsanMtYWRkcmVzc3BhcnNlcidcbmltcG9ydCB7XG4gIG1pbWVXb3Jkc0VuY29kZSxcbiAgbWltZVdvcmRFbmNvZGUsXG4gIGNvbnRpbnVhdGlvbkVuY29kZVxufSBmcm9tICdlbWFpbGpzLW1pbWUtY29kZWMnXG5pbXBvcnQgeyB0b0FTQ0lJIH0gZnJvbSAncHVueWNvZGUnXG5cbi8qKlxuICogSWYgbmVlZGVkLCBtaW1lIGVuY29kZXMgdGhlIG5hbWUgcGFydFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgcGFydCBvZiBhbiBhZGRyZXNzXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBNaW1lIHdvcmQgZW5jb2RlZCBzdHJpbmcgaWYgbmVlZGVkXG4gKi9cbmZ1bmN0aW9uIGVuY29kZUFkZHJlc3NOYW1lIChuYW1lKSB7XG4gIGlmICghL15bXFx3ICddKiQvLnRlc3QobmFtZSkpIHtcbiAgICBpZiAoL15bXFx4MjAtXFx4N2VdKiQvLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldHVybiAnXCInICsgbmFtZS5yZXBsYWNlKC8oW1xcXFxcIl0pL2csICdcXFxcJDEnKSArICdcIidcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG1pbWVXb3JkRW5jb2RlKG5hbWUsICdRJylcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5hbWVcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYSB2YWx1ZSBpcyBwbGFpbnRleHQgc3RyaW5nICh1c2VzIG9ubHkgcHJpbnRhYmxlIDdiaXQgY2hhcnMpXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIFN0cmluZyB0byBiZSB0ZXN0ZWRcbiAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIGlmIGl0IGlzIGEgcGxhaW50ZXh0IHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gaXNQbGFpblRleHQgKHZhbHVlKSB7XG4gIHJldHVybiAhKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycgfHwgL1tcXHgwMC1cXHgwOFxceDBiXFx4MGNcXHgwZS1cXHgxZlxcdTAwODAtXFx1RkZGRl0vLnRlc3QodmFsdWUpKVxufVxuXG4vKipcbiAqIFJlYnVpbGRzIGFkZHJlc3Mgb2JqZWN0IHVzaW5nIHB1bnljb2RlIGFuZCBvdGhlciBhZGp1c3RtZW50c1xuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGFkZHJlc3NlcyBBbiBhcnJheSBvZiBhZGRyZXNzIG9iamVjdHNcbiAqIEBwYXJhbSB7QXJyYXl9IFt1bmlxdWVMaXN0XSBBbiBhcnJheSB0byBiZSBwb3B1bGF0ZWQgd2l0aCBhZGRyZXNzZXNcbiAqIEByZXR1cm4ge1N0cmluZ30gYWRkcmVzcyBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRBZGRyZXNzZXMgKGFkZHJlc3NlcyA9IFtdLCB1bmlxdWVMaXN0ID0gW10pIHtcbiAgLy8gY29uc29sZS5sb2coYWRkcmVzc2VzKVxuICAvLyBjb25zb2xlLmxvZyh1bmlxdWVMaXN0KVxuICB2YXIgdmFsdWVzID0gW11cblxuICA7W10uY29uY2F0KGFkZHJlc3NlcykuZm9yRWFjaChhZGRyZXNzID0+IHtcbiAgICBpZiAoYWRkcmVzcy5hZGRyZXNzKSB7XG4gICAgICBhZGRyZXNzLmFkZHJlc3MgPSBhZGRyZXNzLmFkZHJlc3NcbiAgICAgICAgLnJlcGxhY2UoL14uKj8oPz1AKS8sIHVzZXIgPT4gbWltZVdvcmRzRW5jb2RlKHVzZXIsICdRJykpXG4gICAgICAgIC5yZXBsYWNlKC9ALiskLywgZG9tYWluID0+ICdAJyArIHRvQVNDSUkoZG9tYWluLnN1YnN0cigxKSkpXG5cbiAgICAgIGlmICghYWRkcmVzcy5uYW1lKSB7XG4gICAgICAgIHZhbHVlcy5wdXNoKGFkZHJlc3MuYWRkcmVzcylcbiAgICAgIH0gZWxzZSBpZiAoYWRkcmVzcy5uYW1lKSB7XG4gICAgICAgIHZhbHVlcy5wdXNoKGVuY29kZUFkZHJlc3NOYW1lKGFkZHJlc3MubmFtZSkgKyAnIDwnICsgYWRkcmVzcy5hZGRyZXNzICsgJz4nKVxuICAgICAgfVxuXG4gICAgICBpZiAodW5pcXVlTGlzdC5pbmRleE9mKGFkZHJlc3MuYWRkcmVzcykgPCAwKSB7XG4gICAgICAgIHVuaXF1ZUxpc3QucHVzaChhZGRyZXNzLmFkZHJlc3MpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChhZGRyZXNzLmdyb3VwKSB7XG4gICAgICB2YWx1ZXMucHVzaChlbmNvZGVBZGRyZXNzTmFtZShhZGRyZXNzLm5hbWUpICsgJzonICsgKGFkZHJlc3MuZ3JvdXAubGVuZ3RoID8gY29udmVydEFkZHJlc3NlcyhhZGRyZXNzLmdyb3VwLCB1bmlxdWVMaXN0KSA6ICcnKS50cmltKCkgKyAnOycpXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiB2YWx1ZXMuam9pbignLCAnKVxufVxuXG4vKipcbiAqIFBhcnNlcyBhZGRyZXNzZXMuIFRha2VzIGluIGEgc2luZ2xlIGFkZHJlc3Mgb3IgYW4gYXJyYXkgb3IgYW5cbiAqIGFycmF5IG9mIGFkZHJlc3MgYXJyYXlzIChlZy4gVG86IFtbZmlyc3QgZ3JvdXBdLCBbc2Vjb25kIGdyb3VwXSwuLi5dKVxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IGFkZHJlc3NlcyBBZGRyZXNzZXMgdG8gYmUgcGFyc2VkXG4gKiBAcmV0dXJuIHtBcnJheX0gQW4gYXJyYXkgb2YgYWRkcmVzcyBvYmplY3RzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUFkZHJlc3NlcyAoYWRkcmVzc2VzID0gW10pIHtcbiAgcmV0dXJuIGZsYXR0ZW4oW10uY29uY2F0KGFkZHJlc3NlcykubWFwKChhZGRyZXNzKSA9PiB7XG4gICAgaWYgKGFkZHJlc3MgJiYgYWRkcmVzcy5hZGRyZXNzKSB7XG4gICAgICBhZGRyZXNzID0gY29udmVydEFkZHJlc3NlcyhhZGRyZXNzKVxuICAgIH1cbiAgICByZXR1cm4gcGFyc2VBZGRyZXNzKGFkZHJlc3MpXG4gIH0pKVxufVxuXG4vKipcbiAqIEVuY29kZXMgYSBoZWFkZXIgdmFsdWUgZm9yIHVzZSBpbiB0aGUgZ2VuZXJhdGVkIHJmYzI4MjIgZW1haWwuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleSBIZWFkZXIga2V5XG4gKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgSGVhZGVyIHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGVIZWFkZXJWYWx1ZSAoa2V5LCB2YWx1ZSA9ICcnKSB7XG4gIGtleSA9IG5vcm1hbGl6ZUhlYWRlcktleShrZXkpXG5cbiAgc3dpdGNoIChrZXkpIHtcbiAgICBjYXNlICdGcm9tJzpcbiAgICBjYXNlICdTZW5kZXInOlxuICAgIGNhc2UgJ1RvJzpcbiAgICBjYXNlICdDYyc6XG4gICAgY2FzZSAnQmNjJzpcbiAgICBjYXNlICdSZXBseS1Ubyc6XG4gICAgICByZXR1cm4gY29udmVydEFkZHJlc3NlcyhwYXJzZUFkZHJlc3Nlcyh2YWx1ZSkpXG5cbiAgICBjYXNlICdNZXNzYWdlLUlkJzpcbiAgICBjYXNlICdJbi1SZXBseS1Ubyc6XG4gICAgY2FzZSAnQ29udGVudC1JZCc6XG4gICAgICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJylcblxuICAgICAgaWYgKHZhbHVlLmNoYXJBdCgwKSAhPT0gJzwnKSB7XG4gICAgICAgIHZhbHVlID0gJzwnICsgdmFsdWVcbiAgICAgIH1cblxuICAgICAgaWYgKHZhbHVlLmNoYXJBdCh2YWx1ZS5sZW5ndGggLSAxKSAhPT0gJz4nKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUgKyAnPidcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZVxuXG4gICAgY2FzZSAnUmVmZXJlbmNlcyc6XG4gICAgICB2YWx1ZSA9IFtdLmNvbmNhdC5hcHBseShbXSwgW10uY29uY2F0KHZhbHVlKS5tYXAoKGVsbSA9ICcnKSA9PiBlbG1cbiAgICAgICAgLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJylcbiAgICAgICAgLnRyaW0oKVxuICAgICAgICAucmVwbGFjZSgvPFtePl0qPi9nLCBzdHIgPT4gc3RyLnJlcGxhY2UoL1xccy9nLCAnJykpXG4gICAgICAgIC5zcGxpdCgvXFxzKy8pXG4gICAgICApKS5tYXAoZnVuY3Rpb24gKGVsbSkge1xuICAgICAgICBpZiAoZWxtLmNoYXJBdCgwKSAhPT0gJzwnKSB7XG4gICAgICAgICAgZWxtID0gJzwnICsgZWxtXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVsbS5jaGFyQXQoZWxtLmxlbmd0aCAtIDEpICE9PSAnPicpIHtcbiAgICAgICAgICBlbG0gPSBlbG0gKyAnPidcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZWxtXG4gICAgICB9KVxuXG4gICAgICByZXR1cm4gdmFsdWUuam9pbignICcpLnRyaW0oKVxuXG4gICAgZGVmYXVsdDpcbiAgICAgIHZhbHVlID0gKHZhbHVlIHx8ICcnKS50b1N0cmluZygpLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJylcbiAgICAgIC8vIG1pbWVXb3Jkc0VuY29kZSBvbmx5IGVuY29kZXMgaWYgbmVlZGVkLCBvdGhlcndpc2UgdGhlIG9yaWdpbmFsIHN0cmluZyBpcyByZXR1cm5lZFxuICAgICAgcmV0dXJuIG1pbWVXb3Jkc0VuY29kZSh2YWx1ZSwgJ1EnKVxuICB9XG59XG5cbi8qKlxuICogTm9ybWFsaXplcyBhIGhlYWRlciBrZXksIHVzZXMgQ2FtZWwtQ2FzZSBmb3JtLCBleGNlcHQgZm9yIHVwcGVyY2FzZSBNSU1FLVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgS2V5IHRvIGJlIG5vcm1hbGl6ZWRcbiAqIEByZXR1cm4ge1N0cmluZ30ga2V5IGluIENhbWVsLUNhc2UgZm9ybVxuICovXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplSGVhZGVyS2V5IChrZXkgPSAnJykge1xuICByZXR1cm4ga2V5LnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJykgLy8gbm8gbmV3bGluZXMgaW4ga2V5c1xuICAgIC50cmltKCkudG9Mb3dlckNhc2UoKVxuICAgIC5yZXBsYWNlKC9eTUlNRVxcYnxeW2Etel18LVthLXpdL2lnLCBjID0+IGMudG9VcHBlckNhc2UoKSkgLy8gdXNlIHVwcGVyY2FzZSB3b3JkcywgZXhjZXB0IE1JTUVcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgYSBtdWx0aXBhcnQgYm91bmRhcnkgdmFsdWVcbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGJvdW5kYXJ5IHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUJvdW5kYXJ5IChub2RlSWQsIGJhc2VCb3VuZGFyeSkge1xuICByZXR1cm4gJy0tLS1zaW5pa2FlbC0/PV8nICsgbm9kZUlkICsgJy0nICsgYmFzZUJvdW5kYXJ5XG59XG5cbi8qKlxuICogRXNjYXBlcyBhIGhlYWRlciBhcmd1bWVudCB2YWx1ZSAoZWcuIGJvdW5kYXJ5IHZhbHVlIGZvciBjb250ZW50IHR5cGUpLFxuICogYWRkcyBzdXJyb3VuZGluZyBxdW90ZXMgaWYgbmVlZGVkXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIEhlYWRlciBhcmd1bWVudCB2YWx1ZVxuICogQHJldHVybiB7U3RyaW5nfSBlc2NhcGVkIGFuZCBxdW90ZWQgKGlmIG5lZWRlZCkgYXJndW1lbnQgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZUhlYWRlckFyZ3VtZW50ICh2YWx1ZSkge1xuICBpZiAodmFsdWUubWF0Y2goL1tcXHMnXCJcXFxcOy89XXxeLS9nKSkge1xuICAgIHJldHVybiAnXCInICsgdmFsdWUucmVwbGFjZSgvKFtcIlxcXFxdKS9nLCAnXFxcXCQxJykgKyAnXCInXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHZhbHVlXG4gIH1cbn1cblxuLyoqXG4gKiBKb2lucyBwYXJzZWQgaGVhZGVyIHZhbHVlIHRvZ2V0aGVyIGFzICd2YWx1ZTsgcGFyYW0xPXZhbHVlMTsgcGFyYW0yPXZhbHVlMidcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gc3RydWN0dXJlZCBQYXJzZWQgaGVhZGVyIHZhbHVlXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGpvaW5lZCBoZWFkZXIgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkSGVhZGVyVmFsdWUgKHN0cnVjdHVyZWQpIHtcbiAgdmFyIHBhcmFtc0FycmF5ID0gW11cblxuICBPYmplY3Qua2V5cyhzdHJ1Y3R1cmVkLnBhcmFtcyB8fCB7fSkuZm9yRWFjaChwYXJhbSA9PiB7XG4gICAgLy8gZmlsZW5hbWUgbWlnaHQgaW5jbHVkZSB1bmljb2RlIGNoYXJhY3RlcnMgc28gaXQgaXMgYSBzcGVjaWFsIGNhc2VcbiAgICBpZiAocGFyYW0gPT09ICdmaWxlbmFtZScpIHtcbiAgICAgIGNvbnRpbnVhdGlvbkVuY29kZShwYXJhbSwgc3RydWN0dXJlZC5wYXJhbXNbcGFyYW1dLCA1MCkuZm9yRWFjaChmdW5jdGlvbiAoZW5jb2RlZFBhcmFtKSB7XG4gICAgICAgIC8vIGNvbnRpbnVhdGlvbiBlbmNvZGVkIHN0cmluZ3MgYXJlIGFsd2F5cyBlc2NhcGVkLCBzbyBubyBuZWVkIHRvIHVzZSBlbmNsb3NpbmcgcXVvdGVzXG4gICAgICAgIC8vIGluIGZhY3QgdXNpbmcgcXVvdGVzIG1pZ2h0IGVuZCB1cCB3aXRoIGludmFsaWQgZmlsZW5hbWVzIGluIHNvbWUgY2xpZW50c1xuICAgICAgICBwYXJhbXNBcnJheS5wdXNoKGVuY29kZWRQYXJhbS5rZXkgKyAnPScgKyBlbmNvZGVkUGFyYW0udmFsdWUpXG4gICAgICB9KVxuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXNBcnJheS5wdXNoKHBhcmFtICsgJz0nICsgZXNjYXBlSGVhZGVyQXJndW1lbnQoc3RydWN0dXJlZC5wYXJhbXNbcGFyYW1dKSlcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHN0cnVjdHVyZWQudmFsdWUgKyAocGFyYW1zQXJyYXkubGVuZ3RoID8gJzsgJyArIHBhcmFtc0FycmF5LmpvaW4oJzsgJykgOiAnJylcbn1cbiJdfQ==
/* eslint-disable no-unused-expressions */

import {
  convertAddresses,
  generateBoundary,
  parseAddresses,
  normalizeHeaderKey,
  escapeHeaderArgument,
  encodeHeaderValue,
  buildHeaderValue,
  isPlainText
} from './utils'

describe('#convertAddresses', function () {
  it('should convert address object to a string', function () {
    expect(convertAddresses([{
      name: 'Jõgeva Ants',
      address: 'ants@jõgeva.ee'
    }, {
      name: 'Composers',
      group: [{
        address: 'sebu@example.com',
        name: 'Bach, Sebastian'
      }, {
        address: 'mozart@example.com',
        name: 'Mozzie'
      }]
    }])).to.equal('=?UTF-8?Q?J=C3=B5geva_Ants?= <ants@xn--jgeva-dua.ee>, Composers:"Bach, Sebastian" <sebu@example.com>, Mozzie <mozart@example.com>;')
  })

  it('should keep ascii name as is', function () {
    expect(convertAddresses([{
      name: 'O\'Vigala Sass',
      address: 'a@b.c'
    }])).to.equal('O\'Vigala Sass <a@b.c>')
  })

  it('should include name in quotes for special symbols', function () {
    expect(convertAddresses([{
      name: 'Sass, Vigala',
      address: 'a@b.c'
    }])).to.equal('"Sass, Vigala" <a@b.c>')
  })

  it('should escape quotes', function () {
    expect(convertAddresses([{
      name: '"Vigala Sass"',
      address: 'a@b.c'
    }])).to.equal('"\\"Vigala Sass\\"" <a@b.c>')
  })

  it('should mime encode unicode names', function () {
    expect(convertAddresses([{
      name: '"Jõgeva Sass"',
      address: 'a@b.c'
    }])).to.equal('=?UTF-8?Q?=22J=C3=B5geva_Sass=22?= <a@b.c>')
  })
})

describe('isPlainText', function () {
  it('should return true', function () {
    expect(isPlainText('az09\t\r\n~!?')).to.be.true
  })

  it('should return false on low bits', function () {
    expect(isPlainText('az09\n\x08!?')).to.be.false
  })

  it('should return false on high bits', function () {
    expect(isPlainText('az09\nõ!?')).to.be.false
  })
})

describe('generateBoundary ', function () {
  it('should genereate boundary string', function () {
    const nodeId = 'abc'
    const rootBoundary = 'def'
    expect(generateBoundary(nodeId, rootBoundary)).to.equal('---=abc-def')
  })
})

describe('parseAddresses', function () {
  it('should normalize header key', function () {
    expect(parseAddresses('test address@example.com')).to.deep.equal([{
      address: 'address@example.com',
      name: 'test'
    }])

    expect(parseAddresses(['test address@example.com'])).to.deep.equal([{
      address: 'address@example.com',
      name: 'test'
    }])

    expect(parseAddresses([
      ['test address@example.com']
    ])).to.deep.equal([{
      address: 'address@example.com',
      name: 'test'
    }])

    expect(parseAddresses([{
      address: 'address@example.com',
      name: 'test'
    }])).to.deep.equal([{
      address: 'address@example.com',
      name: 'test'
    }])
  })
})

describe('normalizeHeaderKey', function () {
  it('should normalize header key', function () {
    expect(normalizeHeaderKey('key')).to.equal('Key')
    expect(normalizeHeaderKey('mime-vERSION')).to.equal('MIME-Version')
    expect(normalizeHeaderKey('-a-long-name')).to.equal('-A-Long-Name')
  })
})

describe('escapeHeaderArgument', function () {
  it('should return original value if possible', function () {
    expect(escapeHeaderArgument('abc')).to.equal('abc')
  })

  it('should use quotes', function () {
    expect(escapeHeaderArgument('abc "tere"')).to.equal('"abc \\"tere\\""')
  })
})

describe('encodeHeaderValue', function () {
  it('should do noting if possible', function () {
    expect(encodeHeaderValue('x-my', 'test value')).to.equal('test value')
  })

  it('should encode non ascii characters', function () {
    expect(encodeHeaderValue('x-my', 'test jõgeva value')).to.equal('test =?UTF-8?B?asO1Z2V2YQ==?= value')
  })

  it('should format references', function () {
    expect(encodeHeaderValue('references', 'abc def')).to.equal('<abc> <def>')
    expect(encodeHeaderValue('references', ['abc', 'def'])).to.equal('<abc> <def>')
  })

  it('should format message-id', function () {
    expect(encodeHeaderValue('message-id', 'abc')).to.equal('<abc>')
  })

  it('should format addresses', function () {
    expect(encodeHeaderValue('from', {
      name: 'the safewithme testuser',
      address: 'safewithme.testuser@jõgeva.com'
    })).to.equal('the safewithme testuser <safewithme.testuser@xn--jgeva-dua.com>')
  })
})

describe('buildHeaderValue', function () {
  it('should build header value', function () {
    expect(buildHeaderValue({
      value: 'test'
    })).to.equal('test')
  })
  it('should build header value with params', function () {
    expect(buildHeaderValue({
      value: 'test',
      params: {
        a: 'b'
      }
    })).to.equal('test; a=b')
  })
  it('should build header value with empty params', function () {
    expect(buildHeaderValue({
      value: 'test',
      params: {
        a: ';'
      }
    })).to.equal('test; a=";"')
  })
  it('should build header value with quotes in params', function () {
    expect(buildHeaderValue({
      value: 'test',
      params: {
        a: ';"'
      }
    })).to.equal('test; a=";\\""')
  })
  it('should build header value with multiple params', function () {
    expect(buildHeaderValue({
      value: 'test',
      params: {
        a: 'b',
        c: 'd'
      }
    })).to.equal('test; a=b; c=d')
  })
})

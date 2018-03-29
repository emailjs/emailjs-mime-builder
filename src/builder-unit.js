/* eslint-disable no-unused-expressions */

import Mimebuilder from './builder'

describe('Mimebuilder', function () {
  it('should create Mimebuilder object', function () {
    expect(new Mimebuilder()).to.exist
  })

  describe('createChild', function () {
    it('should create child', function () {
      const mb = new Mimebuilder('multipart/mixed')

      const child = mb.createChild('multipart/mixed')
      expect(child.parentNode).to.equal(mb)
      expect(child.rootNode).to.equal(mb)

      const subchild1 = child.createChild('text/html')
      expect(subchild1.parentNode).to.equal(child)
      expect(subchild1.rootNode).to.equal(mb)

      const subchild2 = child.createChild('text/html')
      expect(subchild2.parentNode).to.equal(child)
      expect(subchild2.rootNode).to.equal(mb)
    })
  })

  describe('appendChild', function () {
    it('should append child node', function () {
      const mb = new Mimebuilder('multipart/mixed')

      const child = new Mimebuilder('text/plain')
      mb.appendChild(child)
      expect(child.parentNode).to.equal(mb)
      expect(child.rootNode).to.equal(mb)
      expect(mb._childNodes.length).to.equal(1)
      expect(mb._childNodes[0]).to.equal(child)
    })
  })

  describe('replace', function () {
    it('should replace node', function () {
      const mb = new Mimebuilder()
      const child = mb.createChild('text/plain')
      const replacement = new Mimebuilder('image/png')

      child.replace(replacement)

      expect(mb._childNodes.length).to.equal(1)
      expect(mb._childNodes[0]).to.equal(replacement)
    })
  })

  describe('remove', function () {
    it('should remove node', function () {
      const mb = new Mimebuilder()
      const child = mb.createChild('text/plain')

      child.remove()
      expect(mb._childNodes.length).to.equal(0)
      expect(child.parenNode).to.not.exist
    })
  })

  describe('setHeader', function () {
    it('should set header', function () {
      const mb = new Mimebuilder()

      mb.setHeader('key', 'value')
      mb.setHeader('key', 'value1')
      expect(mb.getHeader('Key')).to.equal('value1')

      mb.setHeader([{
        key: 'key',
        value: 'value2'
      }, {
        key: 'key2',
        value: 'value3'
      }])

      expect(mb._headers).to.deep.equal([{
        key: 'Key',
        value: 'value2'
      }, {
        key: 'Key2',
        value: 'value3'
      }])

      mb.setHeader({
        key: 'value4',
        key2: 'value5'
      })

      expect(mb._headers).to.deep.equal([{
        key: 'Key',
        value: 'value4'
      }, {
        key: 'Key2',
        value: 'value5'
      }])
    })
  })

  describe('addHeader', function () {
    it('should add header', function () {
      const mb = new Mimebuilder()

      mb.addHeader('key', 'value1')
      mb.addHeader('key', 'value2')

      mb.addHeader([{
        key: 'key',
        value: 'value2'
      }, {
        key: 'key2',
        value: 'value3'
      }])

      mb.addHeader({
        key: 'value4',
        key2: 'value5'
      })

      expect(mb._headers).to.deep.equal([{
        key: 'Key',
        value: 'value1'
      }, {
        key: 'Key',
        value: 'value2'
      }, {
        key: 'Key',
        value: 'value2'
      }, {
        key: 'Key2',
        value: 'value3'
      }, {
        key: 'Key',
        value: 'value4'
      }, {
        key: 'Key2',
        value: 'value5'
      }])
    })
  })

  describe('getHeader', function () {
    it('should return first matching header value', function () {
      const mb = new Mimebuilder()
      mb._headers = [{
        key: 'Key',
        value: 'value4'
      }, {
        key: 'Key2',
        value: 'value5'
      }]

      expect(mb.getHeader('KEY')).to.equal('value4')
    })
  })

  describe('setContent', function () {
    it('should set the contents for a node', function () {
      const mb = new Mimebuilder()
      mb.setContent('abc')
      expect(mb.content).to.equal('abc')
    })
  })

  describe('build', function () {
    it('should build root node', function () {
      const mb = new Mimebuilder('text/plain')
        .setHeader({
          date: '12345',
          'message-id': '67890'
        })
        .setContent('Hello world!')

      const expected = 'Content-Type: text/plain\r\n' +
        'Date: 12345\r\n' +
        'Message-Id: <67890>\r\n' +
        'Content-Transfer-Encoding: 7bit\r\n' +
        'MIME-Version: 1.0\r\n' +
        '\r\n' +
        'Hello world!'

      expect(mb.build()).to.equal(expected)
    })

    it('should build child node', function () {
      const mb = new Mimebuilder('multipart/mixed')
      const childNode = mb.createChild('text/plain')
        .setContent('Hello world!')

      const expected = 'Content-Type: text/plain\r\n' +
        'Content-Transfer-Encoding: 7bit\r\n' +
        '\r\n' +
        'Hello world!'

      expect(childNode.build()).to.equal(expected)
    })

    it('should build multipart node', function () {
      const mb = new Mimebuilder('multipart/mixed', {
        baseBoundary: 'test'
      })
        .setHeader({
          date: '12345',
          'message-id': '67890'
        })

      const expected = 'Content-Type: multipart/mixed; boundary="----sinikael-?=_1-test"\r\n' +
        'Date: 12345\r\n' +
        'Message-Id: <67890>\r\n' +
        'MIME-Version: 1.0\r\n' +
        '\r\n' +
        '------sinikael-?=_1-test\r\n' +
        'Content-Type: text/plain\r\n' +
        'Content-Transfer-Encoding: 7bit\r\n' +
        '\r\n' +
        'Hello world!\r\n' +
        '------sinikael-?=_1-test--\r\n'

      mb.createChild('text/plain').setContent('Hello world!')

      expect(mb.build()).to.equal(expected)
    })

    it('should build root with generated headers', function () {
      const msg = new Mimebuilder('text/plain').build()

      expect(/^Date:\s/m.test(msg)).to.be.true
      expect(/^Message-Id:\s</m.test(msg)).to.be.true
      expect(/^MIME-Version: 1.0$/m.test(msg)).to.be.true
    })

    it('should set content transfer encoding with string', function () {
      let msg = new Mimebuilder('text/plain')
        .setHeader({ 'Content-Transfer-Encoding': 'quoted-printable' })
        .setContent('JÕGEVA')
        .build()
      const expected = 'J=C3=95GEVA'

      msg = msg.split('\r\n\r\n')
      msg.shift()
      msg = msg.join('\r\n\r\n')

      expect(msg).to.equal(expected)
    })

    it('should not include bcc in output, but in envelope', function () {
      const mb = new Mimebuilder('text/plain')
        .setHeader({
          from: 'sender@example.com',
          to: 'receiver@example.com',
          bcc: 'bcc@example.com'
        })
      const msg = mb.build()
      const envelope = mb.getEnvelope()

      expect(envelope).to.deep.equal({
        from: 'sender@example.com',
        to: ['receiver@example.com', 'bcc@example.com']
      })

      expect(/^From: sender@example.com$/m.test(msg)).to.be.true
      expect(/^To: receiver@example.com$/m.test(msg)).to.be.true
      expect(!/^Bcc:/m.test(msg)).to.be.true
    })

    it('should include bcc in output, and in envelope', function () {
      const mb = new Mimebuilder('text/plain', {includeBccInHeader: true})
        .setHeader({
          from: 'sender@example.com',
          to: 'receiver@example.com',
          bcc: 'bcc@example.com'
        })
      const msg = mb.build()
      const envelope = mb.getEnvelope()

      expect(envelope).to.deep.equal({
        from: 'sender@example.com',
        to: ['receiver@example.com', 'bcc@example.com']
      })

      expect(/^From: sender@example.com$/m.test(msg)).to.be.true
      expect(/^To: receiver@example.com$/m.test(msg)).to.be.true
      expect(/^Bcc: bcc@example.com$/m.test(msg)).to.be.true
    })

    it('should have unicode subject', function () {
      const msg = new Mimebuilder('text/plain')
        .setHeader({
          subject: 'Привет и до свидания'
        }).build()

      expect(msg).to.contain('Subject: =?UTF-8?B?0J/RgNC40LLQtdGCINC4INC00L4g0YHQstC40LTQsNC90LjRjw==?=')
    })

    it('should setContent (arraybuffer)', function () {
      const arr = new Uint8Array(256)
      let msg = new Mimebuilder('text/plain')
        .setHeader({ 'Content-Transfer-Encoding': 'base64' })
        .setContent(arr)

      const expected = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4\r\n' +
        'OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3Bx\r\n' +
        'cnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmq\r\n' +
        'q6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj\r\n' +
        '5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w=='

      for (let i = 0, len = arr.length; i < len; i++) {
        arr[i] = i
      }

      msg = msg.build().split('\r\n\r\n')
      msg.shift()
      msg = msg.join('\r\n\r\n')

      expect(msg).to.equal(expected)
    })

    it('should keep 7bit text as is', function () {
      const msg = new Mimebuilder('text/plain')
        .setContent('tere tere')
        .build()

      expect(/\r\n\r\ntere tere$/.test(msg)).to.be.true
      expect(/^Content-Type: text\/plain$/m.test(msg)).to.be.true
      expect(/^Content-Transfer-Encoding: 7bit$/m.test(msg)).to.be.true
    })

    it('should convert 7bit newlines', function () {
      const msg = new Mimebuilder('text/plain')
        .setContent('tere\ntere')
        .build()

      expect(/\r\n\r\ntere\r\ntere$/.test(msg)).to.be.true
    })

    it('should encode 7bit text', function () {
      let msg = new Mimebuilder('text/plain')
        .setContent('tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere')
        .build()

      expect(/^Content-Type: text\/plain; format=flowed$/m.test(msg)).to.be.true
      expect(/^Content-Transfer-Encoding: 7bit$/m.test(msg)).to.be.true

      msg = msg.split('\r\n\r\n')
      msg.shift()
      msg = msg.join('\r\n\r\n')

      expect(msg).to.equal('tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere \r\ntere tere tere tere tere')
    })

    it('should stuff flowed space', function () {
      let msg = new Mimebuilder('text/plain; format=flowed')
        .setContent('tere\r\nFrom\r\n Hello\r\n> abc\nabc')
        .build()

      expect(/^Content-Type: text\/plain; format=flowed$/m.test(msg)).to.be.true
      expect(/^Content-Transfer-Encoding: 7bit$/m.test(msg)).to.be.true

      msg = msg.split('\r\n\r\n')
      msg.shift()
      msg = msg.join('\r\n\r\n')

      expect(msg).to.equal('tere\r\n From\r\n  Hello\r\n > abc\r\nabc')
    })

    it('should use auto charset in unicode text', function () {
      const msg = new Mimebuilder('text/plain')
        .setContent('jõgeva')
        .build()

      expect(/\r\n\r\nj=C3=B5geva$/.test(msg)).to.be.true
      expect(/^Content-Type: text\/plain; charset=utf-8$/m.test(msg)).to.be.true
      expect(/^Content-Transfer-Encoding: quoted-printable$/m.test(msg)).to.be.true
    })

    it('should fetch ascii filename', function () {
      const msg = new Mimebuilder('text/plain', {
        filename: 'jogeva.txt'
      })
        .setContent('jogeva')
        .build()

      expect(/\r\n\r\njogeva$/.test(msg)).to.be.true
      expect(/^Content-Type: text\/plain$/m.test(msg)).to.be.true
      expect(/^Content-Transfer-Encoding: 7bit$/m.test(msg)).to.be.true
      expect(/^Content-Disposition: attachment; filename=jogeva.txt$/m.test(msg)).to.be.true
    })

    it('should set unicode filename', function () {
      const msg = new Mimebuilder('text/plain', {
        filename: 'jõgeva.txt'
      })
        .setContent('jõgeva')
        .build()

      expect(/\r\n\r\nj=C3=B5geva$/.test(msg)).to.be.true
      expect(/^Content-Type: text\/plain; charset=utf-8$/m.test(msg)).to.be.true
      expect(/^Content-Transfer-Encoding: quoted-printable$/m.test(msg)).to.be.true
      expect(/^Content-Disposition: attachment; filename\*0\*=utf-8''j%C3%B5geva.txt$/m.test(msg)).to.be.true
    })

    it('should detect content type from filename', function () {
      const msg = new Mimebuilder(false, {
        filename: 'jogeva.zip'
      })
        .setContent('jogeva')
        .build()

      expect(/^Content-Type: application\/zip$/m.test(msg)).to.be.true
    })

    it('should convert address objects', function () {
      const msg = new Mimebuilder(false)
        .setHeader({
          from: [{
            name: 'the safewithme testuser',
            address: 'safewithme.testuser@jõgeva.com'
          }],
          cc: [{
            name: 'the safewithme testuser',
            address: 'safewithme.testuser@jõgeva.com'
          }]
        })

      expect(/^From: the safewithme testuser <safewithme.testuser@xn--jgeva-dua.com>$/m.test(msg.build())).to.be.true
      expect(/^Cc: the safewithme testuser <safewithme.testuser@xn--jgeva-dua.com>$/m.test(msg.build())).to.be.true

      expect(msg.getEnvelope()).to.deep.equal({
        from: 'safewithme.testuser@xn--jgeva-dua.com',
        to: [
          'safewithme.testuser@xn--jgeva-dua.com'
        ]
      })
    })

    it('should skip empty header', function () {
      const mb = new Mimebuilder('text/plain')
        .setHeader({
          a: 'b',
          cc: '',
          dd: [],
          o: false,
          date: 'zzz',
          'message-id': '67890'
        })
        .setContent('Hello world!')
      const expected = 'Content-Type: text/plain\r\n' +
        'A: b\r\n' +
        'Date: zzz\r\n' +
        'Message-Id: <67890>\r\n' +
        'Content-Transfer-Encoding: 7bit\r\n' +
        'MIME-Version: 1.0\r\n' +
        '\r\n' +
        'Hello world!'

      expect(mb.build()).to.equal(expected)
    })

    it('should set default transfer encoding for application content', function () {
      const mb = new Mimebuilder('application/x-my-stuff')
        .setHeader({
          date: '12345',
          'message-id': '67890'
        })
        .setContent('Hello world!')

      const expected = 'Content-Type: application/x-my-stuff\r\n' +
          'Date: 12345\r\n' +
          'Message-Id: <67890>\r\n' +
          'Content-Transfer-Encoding: base64\r\n' +
          'MIME-Version: 1.0\r\n' +
          '\r\n' +
          'SGVsbG8gd29ybGQh'

      expect(mb.build()).to.equal(expected)
    })

    it('should not set transfer encoding for multipart content', function () {
      const mb = new Mimebuilder('multipart/global')
        .setHeader({
          date: '12345',
          'message-id': '67890'
        })
        .setContent('Hello world!')
      const expected = 'Content-Type: multipart/global; boundary=abc\r\n' +
          'Date: 12345\r\n' +
          'Message-Id: <67890>\r\n' +
          'MIME-Version: 1.0\r\n' +
          '\r\n' +
          'Hello world!\r\n' +
          '\r\n' +
          '--abc--' +
          '\r\n'

      mb.boundary = 'abc'

      expect(mb.build()).to.equal(expected)
    })

    it('should use from domain for message-id', function () {
      const mb = new Mimebuilder('text/plain')
        .setHeader({
          from: 'test@example.com'
        })

      expect(/^Message-Id: <\d+(-[a-f0-9]{8}){3}@example\.com>$/m.test(mb.build())).to.be.true
    })

    it('should fallback to localhost for message-id', function () {
      const mb = new Mimebuilder('text/plain')

      expect(/^Message-Id: <\d+(-[a-f0-9]{8}){3}@localhost>$/m.test(mb.build())).to.be.true
    })
  })

  describe('getEnvelope', function () {
    it('should get envelope', function () {
      expect(new Mimebuilder().addHeader({
        from: 'From <from@example.com>',
        sender: 'Sender <sender@example.com>',
        to: 'receiver1@example.com'
      }).addHeader({
        to: 'receiver2@example.com',
        cc: 'receiver1@example.com, receiver3@example.com',
        bcc: 'receiver4@example.com, Rec5 <receiver5@example.com>'
      }).getEnvelope()).to.deep.equal({
        from: 'from@example.com',
        to: ['receiver1@example.com', 'receiver2@example.com', 'receiver3@example.com', 'receiver4@example.com', 'receiver5@example.com']
      })

      expect(new Mimebuilder().addHeader({
        sender: 'Sender <sender@example.com>',
        to: 'receiver1@example.com'
      }).addHeader({
        to: 'receiver2@example.com',
        cc: 'receiver1@example.com, receiver3@example.com',
        bcc: 'receiver4@example.com, Rec5 <receiver5@example.com>'
      }).getEnvelope()).to.deep.equal({
        from: 'sender@example.com',
        to: ['receiver1@example.com', 'receiver2@example.com', 'receiver3@example.com', 'receiver4@example.com', 'receiver5@example.com']
      })
    })
  })

  describe('_addBoundary', function () {
    it('should do nothing on non multipart', function () {
      const mb = new Mimebuilder()
      expect(mb.boundary).to.not.exist
      mb._addBoundary({
        value: 'text/plain'
      })
      expect(mb.boundary).to.be.false
      expect(mb.multipart).to.be.false
    })

    it('should use provided boundary', function () {
      const mb = new Mimebuilder()
      expect(mb.boundary).to.not.exist
      mb._addBoundary({
        value: 'multipart/mixed',
        params: {
          boundary: 'abc'
        }
      })
      expect(mb.boundary).to.equal('abc')
      expect(mb.multipart).to.equal('mixed')
    })

    it('should generate boundary', function () {
      const mb = new Mimebuilder()

      expect(mb.boundary).to.not.exist
      mb._addBoundary({
        value: 'multipart/mixed',
        params: {}
      })
      expect(mb.boundary).to.exist
      expect(mb.multipart).to.equal('mixed')
    })
  })
})

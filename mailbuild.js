// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/* global define: false, mimefuncs: false, mimetypes: false, punycode: false, addressparser: false */

// AMD shim
(function(root, factory) {

    "use strict";

    if (typeof define === 'function' && define.amd) {
        define([
            "./mimefuncs",
            "./mimetypes/mimetypes",
            "./punycode",
            "./addressparser"
        ], factory);
    } else {
        root.mailbuild = factory(mimefuncs, mimetypes, punycode, addressparser);
    }
}(this, function(mimefuncs, mimetypes, punycode, addressparser) {

    "use strict";

    function MimeNode(contentType, options){
        this.nodeCounter = 0;

        options = options || {};

        if(!options.rootNode){
            this.baseBoundary = options.baseBoundary || Date.now(); // useful for unique-like boundaries
            this.date = new Date();
        }

        this.rootNode = options.rootNode || this;
        this.nodeId = ++this.rootNode.nodeCounter;

        if(options.filename){
            this.filename = options.filename;
            if(!contentType){
                contentType = mimetypes.detectMimeType(this.filename.split(".").pop());
            }
        }

        this.parentNode = options.parentNode;
        this.childNodes = [];

        this.headers = [];

        if(contentType){
            this.setHeader("content-type", contentType);
        }
    }

    MimeNode.prototype.addChild = function(contentType, options){
        var node,
            nodeOptions = {
                parentNode: this,
                rootNode: this.rootNode
            };

        if(!options && typeof contentType == "object"){
            options = contentType;
            contentType = undefined;
        }

        Object.keys(options || {}).forEach(function(key){
            nodeOptions[key] = options[key];
        });

        node = new MimeNode(contentType, nodeOptions);

        this.childNodes.push(node);
        return node;
    };

    MimeNode.prototype.removeChild = function(node){
        for(var i = this.childNodes.length - 1; i >= 0; i--){
            if(this.childNodes[i] == node){
                this.childNodes.splice(i, 1);
                return node;
            }
        }
    };

    MimeNode.prototype.setHeader = function(key, value){
        var added = false;

        // Allow setting multiple headers at once
        if(!value && key && typeof key == "object"){
            // allow {key:"content-type", value: "text/plain"}
            if(key.key && key.value){
                this.setHeader(key.key, key.value);
            }
            // allow [{key:"content-type", value: "text/plain"}]
            else if(Array.isArray(key)){
                key.forEach(function(i){
                    this.setHeader(i.key, i.value);
                });
            }
            // allow {'content-type': 'text/plain'}
            else{
                Object.keys(key).forEach((function(i){
                    this.setHeader(i, key[i]);
                }).bind(this));
            }
            return this;
        }

        key = this.normalizeHeaderKey(key);

        var headerValue = {
            key: this.normalizeHeaderKey(key),
            value: this.normalizeHeaderValue(key, value)
        };

        for(var i = 0, len = this.headers.length; i<len; i++){
            if(this.headers[i].key == key){
                if(!added){
                    this.headers[i] = headerValue;
                    added = true;
                }else{
                    this.headers.splice(i, 1);

                    i--;
                    len--;
                }
            }
        }
        if(!added){
            this.headers.push(headerValue);
        }

        return this;
    };

    MimeNode.prototype.getHeader = function(key){
        key = this.normalizeHeaderKey(key);
        for(var i = 0, len = this.headers.length; i<len; i++){
            if(this.headers[i].key == key){
                return this.headers[i].value;
            }
        }
    };

    MimeNode.prototype.normalizeHeaderKey = function(key){
        return (key || "").toString().
          // no newlines in keys
          replace(/\r?\n|\r/g, " ").
          trim().toLowerCase().
          // use uppercase words, except MIME
          replace(/^MIME\b|^[a-z]|\-[a-z]/ig, function(c){
            return c.toUpperCase();
        });
    };

    MimeNode.prototype.normalizeHeaderValue = function(key, value){
        var structured = mimefuncs.parseHeaderValue(value);

        switch(key){
        case "Content-Type":
            // generate boundary for multipart
            this.checkContentType(structured);

            if(this.multipart && !structured.params.boundary){
                structured.params.boundary = this.boundary;
            }
            break;
        default:
            // For unlisted type return the value as is
            return value;
        }

        return this.buildHeaderValue(structured);
    };

    MimeNode.prototype.buildHeaderValue = function(structured){
        var paramsArray = [];

        Object.keys(structured.params).forEach((function(param){
            paramsArray.push(param + "=" + this.escapeHeaderValue(structured.params[param]));
        }).bind(this));

        return structured.value + (paramsArray.length ? "; " + paramsArray.join("; ") : "");
    };

    MimeNode.prototype.escapeHeaderValue = function(value){
        if(value.match(/[\s"\\';\/]|^\-/g)){
            return '"' + value.replace(/(["\\])/g, "\\$1") + '"';
        }else{
            return value;
        }
    };

    MimeNode.prototype.checkContentType = function(structured){
        this.contentType = structured.value.trim().toLowerCase();

        this.multipart = this.contentType.split("/").reduce(function(prev, value){
            return prev == "multipart" ? value : false;
        });

        this.boundary = this.multipart ?
            structured.params.boundary || this.boundary || this.generateBoundary() :
            false;
    };

    MimeNode.prototype.setContent = function(content){
        this.content = content;
        return this;
    };

    MimeNode.prototype.generateBoundary = function(){
        return "----sinikael-?=_" + this.nodeId + "-" + this.rootNode.baseBoundary;
    };

    MimeNode.prototype.encodeHeaderValue = function(key, value){
        key = this.normalizeHeaderKey(key);

        var addresses;

        switch(key){
        case "From":
        case "Sender":
        case "To":
        case "Cc":
        case "Bcc":
        case "Reply-To":
            addresses = [].concat.apply([], [].concat(value).map(addressparser.parse));
            return this.convertAddresses(addresses);

        case "Message-Id":
        case "In-Reply-To":
        case "Content-Id":
            value = (value || "").toString().replace(/\r?\n|\r/g, " ");

            if(value.charAt(0)!="<"){
                value = "<"+value;
            }

            if(value.charAt(value.length-1)!=">"){
                value = value + ">";
            }
            return value;

        case "References":
            value = [].concat.apply([], [].concat(value || "").map(function(elm){
                    elm = (elm || "").toString().replace(/\r?\n|\r/g, " ").trim();
                    return elm.replace(/<[^>]*>/g,function(str){
                        return str.replace(/\s/g, "");
                    }).split(/\s+/);
                })).map(function(elm){
                    if(elm.charAt(0) != "<"){
                        elm = "<" + elm;
                    }
                    if(elm.charAt(elm.length-1) != ">"){
                        elm = elm + ">";
                    }
                    return elm;
                });

            return value.join(" ").trim();

        default:
            value = (value || "").toString().replace(/\r?\n|\r/g, " ");
            return mimefuncs.mimeWordsEncode(value, "Q");
        }

        return value;
    };

    MimeNode.prototype.convertAddresses = function(addresses){
        var values = [];

        addresses.forEach((function(address){
            if(address.address){
                address.address = address.address.replace(/^.*?(?=\@)/, function(user){
                    return mimefuncs.mimeWordsEncode(user, "Q");
                }).replace(/@.+$/, function(domain){
                    return "@" + punycode.toASCII(domain.substr(1));
                });

                if(!address.name){
                    values.push(address.address);
                }else if(address.name){
                    address.name = mimefuncs.mimeWordsEncode(address.name, "Q");
                    values.push('"' + address.name+'" <'+address.address+'>');
                }
            }else if(address.group){
                values.push(address.name + ":" + (address.group.length ? this.convertAddresses(address.group) : "").trim() + ";");
            }
        }).bind(this));

        return values.join(", ");
    };

    MimeNode.prototype.build = function(){
        var lines = [], transferEncoding, flowed, filename;

        if(this.content){
            transferEncoding = (this.getHeader("Content-Transfer-Encoding") || "").toString().toLowerCase().trim();
            if(!transferEncoding || ["base64", "quoted-printable"].indexOf(transferEncoding) < 0){
                if(this.contentType && this.contentType.match(/^text\//i)){
                    if(
                      typeof this.content == "string" &&
                      !/[\x00-\x08\x0b\x0c\x0e-\x1f\u0080-\uFFFF]/.test(this.content)
                    ){
                        if(/^.{77,}/m.test(this.content)){
                            flowed = true;
                        }
                        transferEncoding = "7bit";
                    }else{
                        transferEncoding = "quoted-printable";
                    }
                }else{
                    transferEncoding = "base64";
                }
            }
            this.setHeader("Content-Transfer-Encoding", transferEncoding);
        }

        if(this.filename){
            filename = mimefuncs.mimeWordsEncode(this.filename, "Q");
            if(!this.getHeader("Content-Disposition")){
                this.setHeader("Content-Disposition", "attachment");
            }
        }

        this.headers.forEach((function(header){
            var key = header.key,
                value = header.value,
                structured;

            switch(header.key){
            case "Content-Disposition":
                structured = mimefuncs.parseHeaderValue(value);
                if(filename){
                    structured.params.filename = filename;
                }
                value = this.buildHeaderValue(structured);
                break;
            case "Content-Type":
                structured = mimefuncs.parseHeaderValue(value);
                if(flowed){
                    structured.params.format = "flowed";
                }
                if(structured.value.match(/^text\//) && typeof this.content == "string" && /[\u0080-\uFFFF]/.test(this.content)){
                    structured.params.charset = "utf-8";
                }
                if(filename){
                    structured.params.name = filename;
                }
                value = this.buildHeaderValue(structured);
                break;
            }

            lines.push(mimefuncs.foldLines(key + ": " + this.encodeHeaderValue(key, value), 76));
        }).bind(this));

        // Ensure mandatory header fields
        if(this.rootNode == this){
            if(!this.getHeader("Date")){
                lines.push("Date: " + this.date.toUTCString().replace(/GMT/, "+0000"));
            }
            // You really should define your own Message-Id field
            if(!this.getHeader("Message-Id")){
                lines.push("Message-Id: <" + this.date.getTime() + "@localhost>");
            }
            if(!this.getHeader("MIME-Version")){
                lines.push("MIME-Version: 1.0");
            }
        }
        lines.push("");

        if(this.content){

            switch(transferEncoding){
            case "quoted-printable":
                lines.push(mimefuncs.quotedPrintableEncode(this.content));
                break;
            case "base64":
                lines.push(mimefuncs.base64Encode(this.content, typeof this.content == "object" && "binary" || false));
                break;
            default:
                if(flowed){
                    lines.push(mimefuncs.foldLines(this.content.
                        // space stuffing http://tools.ietf.org/html/rfc3676#section-4.2
                        replace(/^( |From|>)/igm, " $1"),
                        76, true));
                }else{
                    lines.push(this.content);
                }
            }
            if(this.multipart){
                lines.push("");
            }
        }

        if(this.multipart){
            this.childNodes.forEach((function(node){
                lines.push("--" + this.boundary);
                lines.push(node.build());
            }).bind(this));
            lines.push("--" + this.boundary + "--");
            lines.push("");
        }

        return lines.join("\r\n");
    };

    return function(contentType, options){
        return new MimeNode(contentType, options);
    };
}));

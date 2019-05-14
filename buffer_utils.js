/**
 * Copyright 2019 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
 module.exports = function(RED) {
    var settings = RED.settings;
    const buff = require('buffer');
    const replace = require('buffer-replace');
    const bitwise = require('bitwise').buffer;
    // See https://github.com/bartbutenaers/node-red-contrib-multipart-stream-decoder/blob/master/multipart_decoder.js
    // where is explained why I have chosen the node-buffers library.
    var Buffers = require('node-buffers');

    function BufferManipulationNode(config) {
        RED.nodes.createNode(this, config);
        
        this.action       = config.action;
        this.buffer1Field = config.buffer1Field || 'payload';
        this.buffer2Field = config.buffer2Field || 'payload';
        this.outputField  = config.outputField || 'payload';
        this.arrayField   = config.arrayField || 'payload';
        this.encoding     = config.encoding || "utf8";
        this.encoding2    = config.encoding2 || "utf8";
        this.start        = parseInt(config.start || 0);
        this.start2       = parseInt(config.start || 0);
        this.end          = parseInt(config.end || 0);
        this.start2       = parseInt(config.start || 0);
        this.length       = parseInt(config.length || 0);
        this.fill         = parseInt(config.fill || 0);
        this.index        = parseInt(config.index || 0);
        this.string       = config.string || "";
        this.buffers      = Buffers();
        
        var node = this;
        
        node.on("input", function(msg) {
            var buffer1;
            var buffer2;
            var array;
            var result;
            
            // Buffer1 is required for most actions
            if (!["create", "concat", "concatlength"].includes(node.action)) {
                try {
                    buffer1 = RED.util.getMessageProperty(msg, node.buffer1Field);
                } 
                catch(err) {
                    node.error("The input msg." + node.buffer1Field + " field can not be read");
                    return;
                }
            }
            
            // Buffer2 is only required for some actions
            if (["compare", "equals", "and", "nand", "nor", "or", "xnor", "xor"].includes(node.action)) {
                try {
                    buffer2 = RED.util.getMessageProperty(msg, node.buffer2Field);
                } 
                catch(err) {
                    node.error("The input msg." + node.buffer2Field + " field can not be read");
                    return;
                }
            }           
            
            // Array field is only required for concatenations
            if (["concat", "concatlength"].includes(node.action)) {
                try {
                    array = RED.util.getMessageProperty(msg, node.arrayField);
                } 
                catch(err) {
                    node.error("The input msg." + node.arrayField + " field can not be read");
                    return;
                }
            }

            switch (node.action) {
                case "create":
                    // The (pre)fill value can be <string>, <Buffer>,<Uint8Array> or <integer>.  The default is 0.
                    // The encoding is only useful if the fill value is a string. Default encoding is 'utf8'.
                    // TODO perhaps support Buffer.allocUnsafe and Buffer.allocUnsafeSlow in the future ...
                    result = Buffer.alloc(node.length, node.fill, node.encoding);
                    break;
                case "bytelength":
                    // In contradiction to the 'length', the 'bytelength' contains the length of the current content of the buffer.
                    result = Buffer.byteLength(buffer1, node.encoding);
                    break;
                case "compare":
                    result = Buffer.compare(buffer1, buffer2);
                    break;
                case "concat":
                    if(!Array.isArray(array)) {
                        node.error("The msg." + node.arrayField + " is not an array");
                        return;
                    }
                    
                    // TODO test whether the array contains buffers or uint8arrays
                
                    // Concatenate an <Buffer[]> or <Uint8Array[]> into a single buffer.
                    result = Buffer.concat(array);
                    break;
                case "concatlength":
                    if(!Array.isArray(array)) {
                        node.error("The msg." + node.arrayField + " is not an array");
                        return;
                    }
                    
                    // TODO test whether the array contains buffers or uint8arrays
                
                    // Concatenate an <Buffer[]> or <Uint8Array[]> into a single buffer.
                    // Specify the total length of the Buffer instances in list when concatenated.
                    // If the combined length of the Buffers in list exceeds totalLength, the result is truncated to totalLength.
                    result = Buffer.concat(array, node.length);
                    break;
                case "isBuffer":
                    result = Buffer.isBuffer(buffer1);
                    break;
                case "copy":    
                    // Copy the existing <Buffer> or <Uint8Array> data to a new buffer
                    result = Buffer.from(buffer1);
                    break;
                case "copypart":
                    result = Buffer.allocUnsafe(node.end - node.start);
                    // target <Buffer> | <Uint8Array> A Buffer or Uint8Array to copy into.
                    // targetStart <integer> The offset within target at which to begin writing. Default: 0.
                    // sourceStart <integer> The offset within buf from which to begin copying. Default: 0.
                    // sourceEnd <integer> The offset within buf at which to stop copying (not inclusive). Default: buf.length.
                    buffer1.copy(result, node.start2, node.start, node.end);
                    break;
                case "isEncoding":
                    // Returns true if encoding contains a supported character encoding, or false otherwise.
                    result = Buffer.isEncoding(node.encoding);
                    break;
                case "get":
                    // Get the octet at the specified position <integer> in the buffer.
                    // TODO when index not exists in the buffer, an empty message is returned.  Is that correct ??
                    result = buffer1[node.index];
                    break;
                case "set":
                    // Set the octet at the specified position in the buffer to the specified value.
                    // The values refer to individual bytes, so the legal value range is between 0x00 and 0xFF (hex) or 0 and 255 (decimal).
                    buffer1[node.index] = node.fill;
                    result = buffer1;
                    break;
                case "equals":
                    // otherBuffer <Buffer> | <Uint8Array> A Buffer or Uint8Array with which to compare buf.
                    // Returns true if both buf and otherBuffer have exactly the same bytes, false otherwise.
                    result = buffer1.equals(buffer2);
                    break;
                case "fill":
                    // value <string> | <Buffer> | <Uint8Array> | <integer> The value with which to fill buf.
                    // offset <integer> Number of bytes to skip before starting to fill buf. Default: 0.
                    // end <integer> Where to stop filling buf (not inclusive). Default: buf.length.
                    // encoding <string> The encoding for value if value is a string. Default: 'utf8'.
                    // Fills buf with the specified value. If the offset and end are not given, the entire buf will be filled:
                    result = buffer1.fill(node.fill, 0, buffer1.length, node.encoding);
                    break;
                case "fillpart":
                    // value <string> | <Buffer> | <Uint8Array> | <integer> The value with which to fill buf.
                    // offset <integer> Number of bytes to skip before starting to fill buf. Default: 0.
                    // end <integer> Where to stop filling buf (not inclusive). Default: buf.length.
                    // encoding <string> The encoding for value if value is a string. Default: 'utf8'.
                    // Fills buf with the specified value. If the offset and end are not given, the entire buf will be filled:
                    result = buffer1.fill(node.fill, node.start, node.end, node.encoding);
                    break;
                case "indexof":
                    // value <string> | <Buffer> | <Uint8Array> | <integer> What to search for.
                    // byteOffset <integer> Where to begin searching in buf. If negative, then offset is calculated from the end of buf. Default: 0.
                    // encoding <string> If value is a string, this is the encoding used to determine the binary representation of the string that will be searched for in buf. Default: 'utf8'.
                    // Returns: <integer> The index of the first occurrence of value in buf, or -1 if buf does not contain value.
                    // If value is:
                    // a string, value is interpreted according to the character encoding in encoding.
                    // a Buffer or Uint8Array, value will be used in its entirety. To compare a partial Buffer, use buf.slice().
                    // a number, value will be interpreted as an unsigned 8-bit integer value between 0 and 255.
                    result = buffer1.indexOf(node.fill, node.start, node.encoding);
                    break;
                case "allindexof":
                    var index = 0;
                    var offset = node.start - 1;
                    
                    result = [];   
                    
                    // Search all indexes by incrementing the offset
                    while (index != -1) {
                        index = buffer1.indexOf(node.fill, offset + 1);
                        offset = index;
                        
                        if (index >= 0) {
                            result.push(index);
                        }
                    }
                      
                    break;
                case "keys":
                    // Creates and returns an iterator of buf keys (indices).
                    result = buffer1.keys();
                    break;
                case "lastindexof":
                    // value <string> | <Buffer> | <Uint8Array> | <integer> What to search for.
                    // byteOffset <integer> Where to begin searching in buf. If negative, then offset is calculated from the end of buf. Default: buf.length- 1.
                    // encoding <string> If value is a string, this is the encoding used to determine the binary representation of the string that will be searched for in buf. Default: 'utf8'.
                    // Returns: <integer> The index of the last occurrence of value in buf, or -1 if buf does not contain value.
                    result = buffer1.lastIndexOf(node.fill, node.start, node.encoding);
                    break;
                case "length":
                    // Returns the amount of memory allocated for buf in bytes. Note that this does not necessarily reflect the amount of "usable" data within buf.
                    result = buffer1.length;
                    break;
                case "slice":    
                    // start <integer> Where the new Buffer will start. Default: 0.
                    // end <integer> Where the new Buffer will end (not inclusive). Default: buf.length.
                    // Returns a new Buffer that references the same memory as the original, but offset and cropped by the start and end indices.
                    result = buffer1.slice(node.start, node.end);
                    break;
                case "collect":
                    // TODO is encoding nodig ?????
                    if (!node.collector) {
                        node.collector = Buffer.alloc(node.length/*, node.fill, node.encoding*/);
                    }

                    var contentLength = Buffer.byteLength(node.collector /*,node.encoding*/);
                    
                    node.collector[
                    
                    
                    if (contentLength >= node.length) {
                        
                    }
                
                    break;
                case "tojson":
                    // Returns a JSON representation of buf. JSON.stringify() implicitly calls this function when stringifying a Buffer instance.
                    result = buffer1.toJSON();
                    break;
                case "tostring":
                    // encoding <string> The character encoding to use. Default: 'utf8'.
                    // start <integer> The byte offset to start decoding at. Default: 0.
                    // end <integer> The byte offset to stop decoding at (not inclusive). Default: buf.length.
                    // Decodes buf to a string according to the specified character encoding in encoding. start and end may be passed to decode only a subset of buf.
                    result = buffer1.toString(node.encoding, node.start, node.end);
                    break;
                case "write":
                    // string <string> String to write to buf.
                    // offset <integer> Number of bytes to skip before starting to write string. Default: 0.
                    // length <integer> Number of bytes to write. Default: buf.length - offset.
                    // encoding <string> The character encoding of string. Default: 'utf8'.
                    // Returns: <integer> Number of bytes written.
                    // Writes string to buf at offset according to the character encoding in encoding. The length parameter is the number of bytes to write. If buf did not contain enough space to fit the entire string, only part of string will be written. However, partially encoded characters will not be written.
                    result = buffer1.write(node.string, node.start, node.length, node.encoding);
                    break;
                case "transcode":
                    // source <Buffer> | <Uint8Array> A Buffer or Uint8Array instance.
                    // fromEnc <string> The current encoding.
                    // toEnc <string> To target encoding.
                    // Re-encodes the given Buffer or Uint8Array instance from one character encoding to another. Returns a new Buffer instance.
                    // Throws if the fromEnc or toEnc specify invalid character encodings or if conversion from fromEnc to toEnc is not permitted.
                    // Encodings supported by buffer.transcode() are: 'ascii', 'utf8', 'utf16le', 'ucs2', 'latin1', and 'binary'.
                    result = buff.transcode(buffer1, node.encoding, node.encoding2);
                    break;
                case "replace":
                    // argument can be either buffers or strings
                    result = replace(buffer1, node.string, node.string2);    
                    break;
                case "splitlength":
                    // Register the new buffer1 in the buffer list (so we can consider them as 1 large buffer)
                    node.buffers.push(buffer1);
                    
                    if (node.buffers.length >= node.length) {
                        // Enough data has been received, so get the specified length (and remove it from node.buffers)
                        // Convert the Buffers list to a single NodeJs buffer, that can be understood by the Node-Red flow
                        result = node.buffers.splice(0, node.length).toBuffer();
                    }
                   
                    break;
                case "splitdelimiter":
                    var index = -1;
                    var fillLength = node.fill.length;
                    
                    result = [];
                                        
                    if (fillLength === null && node.fill !== null) {
                        if (!isNaN(node.fill)) {
                            // If the buffer contains a number (which has no length property), we will determine the length.
                            fillLength = node.fill.toString().length;
                        }
                    }
                    
                    if (fillLength === null) {
                        // Avoid infinite loops in the loop below
                        node.error("The length of msg." + node.buffer1Field + " cannot be determined");
                        return;
                    }
                    
                    // Register the new buffer1 in the buffer list (so we can consider them as 1 large buffer)
                    node.buffers.push(buffer1);

                    while((index = node.buffers.indexOf(node.fill)) > -1){
                        result.push(node.buffers.splice(0, index));
                        // Remove the delimiter itself from the node.buffers
                        node.buffers.splice(0, index + fillLength);
                    }
                    
                    // TODO als de delimiter niet gevonden wordt, dan zal de node.buffers te groot worden.
                    // Best een maximum size op het scherm opgeven ...

                    // We will keep the remaining of the buffer, to analyze when the next message arrives
                    // TODO dit misschien instelbaar maken??????  Dus checkbox 'enable cross-message processing'
                    //result.push(node.buffers.splice(0, node.buffers.length));
                    break;
                case "and":
                // TODO in all bitwise operations (except 'not') both buffers should have equal length.
                // En wat moet de inhoud van die buffers zijn (enkel 0 en 1) ????
                    result = bitwise.and(buffer1, buffer2, false);
                    break;
                case "nand":
                    result = bitwise.nand(buffer1, buffer2, false);
                    break;
                case "nor":
                    result = bitwise.nand(buffer1, buffer2, false);
                    break;
                case "not":
                    result = bitwise.nand(buffer1, false);
                    break;
                case "or":
                    result = bitwise.or(buffer1, buffer2, false)
                    break;                    
                case "xnor":
                    result = bitwise.xnor(buffer1, buffer2, false)
                    break;                       
                case "xor":
                    result = bitwise.xor(buffer1, buffer2, false)
                    break;                        
                    
                //TODO Add cases for:
                // 1. Remove at index
                // 2. Split at posistion --> returns an array of buffers
                // 3. Split at value --> returns an array of buffers
                // 4. Replace value1 by value2
                // TODO ook checken of die string en string2 velden nodig zijn?  Misschien voldoet node.fill ook?
                // En checken of we the fill veld niet door een typedfield (msg/str/...) kunnen vervangen?  Maar dan moeten we custom type kunnen toevoegen.
            }
            
            // Write the result in the specified output message field
            if (result !== null) {
                try {
                    RED.util.setMessageProperty(msg, node.outputField, result);
                } 
                catch(err) {
                    node.error("The output msg." + node.outputField + " field can not be written");
                    return;
                }
            }
            
            node.send(msg);
        });
        
        node.on("close",function() {
            // Remove all buffers, if available
            node.buffers.splice(0, node.buffers.length - 1);
        });
    }

    RED.nodes.registerType("buffer-utils", BufferManipulationNode);
}

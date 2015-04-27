// base64.js     Operations on base64
//
angular.module('replictest.base64', [])

.factory('Base64', function() {
    return {
        encode:
            function (s) {
                // Encode a string into base64, returning a string.
                //
                s += '\0'; // Force out last few bits
                var res = '';
                var bits = 0, bitct = 0;
                for (var i = 0; i < s.length; i++) {
                    bits = (bits << 8) + s.charCodeAt(i);
                    bitct += 8;
                    while (bitct >= 6) {
                        var b = (bits >> (bitct - 6)) & 0x3F;
                        if (b <= 25)
                            res += String.fromCharCode(b + 65)
                        else if (b <= 51)
                            res += String.fromCharCode(b + 71)
                        else if (b <= 61)
                            res += String.fromCharCode(b - 4)
                        else if (b == 62)
                            res += '+';
                        else
                            res += '/';
                        bitct -= 6;
                    }
                }
                switch (s.length % 3) {
                case 0: res = res.slice(0, -1) + '='; break;
                case 1: res = res.slice(0, -1); break;
                case 2: res += '=='; break;
                }
                return res;
            },
        decode:
            function(s) {
              // Decode a base64 string, returning a Uint8Array.
              //
              var length = s.length;
              while (length > 0 && s[length - 1] == '=') length--;

              var res = new Uint8Array(Math.floor(length * 6 / 8));
              var resix = 0;
              var bits = 0, bitct = 0;
              for(var i = 0; i < length; i++) {
                  bits = bits << 6;
                  var code = s.charCodeAt(i);
                  if (code >= 65 && code <= 90) bits += code - 65;
                  else if (code >= 97 && code <= 122) bits += code - 71;
                  else if (code >= 48 && code <= 57) bits += code + 4;
                  else if (code == 43) bits += 62;
                  else if (code == 47) bits += 63;
                  bitct += 6;
                  while (bitct >= 8) {
                      res[resix++] = (bits >> (bitct - 8)) & 0xFF;
                      bitct -= 8;
                  }
                  bits &= 0x3F;  // At most 6 good bits remain
              }
              return res;
            }
    };
})

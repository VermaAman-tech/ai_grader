/** Safe embedding of JSON inside <script> tags (mitigates </script> and U+2028/2029 breaks). */
function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

module.exports = { jsonForScript };

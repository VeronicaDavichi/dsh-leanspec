window.__ModuleLoader__.load({ id: "dsh-leanspec", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/LeanspecHeaderAction.ts
var import_react4 = require("react");

// src/client/LeanspecViewer.ts
var import_react2 = require("react");

// src/media.ts
var IMAGE_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  avif: "image/avif",
  ico: "image/x-icon",
  svg: "image/svg+xml"
};
var MAX_IMAGE_BYTES = 20 * 1024 * 1024;
function extensionOf(relPath) {
  const normalised = relPath.replaceAll("\\", "/");
  if (normalised === "" || normalised.endsWith("/")) return void 0;
  const base = normalised.slice(normalised.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return void 0;
  const extension = base.slice(dot + 1).toLowerCase();
  return extension === "" ? void 0 : extension;
}
function imageMimeType(relPath) {
  const extension = extensionOf(relPath);
  return extension === void 0 ? void 0 : IMAGE_MIME[extension];
}
function isImagePath(relPath) {
  return imageMimeType(relPath) !== void 0;
}
function isSvgPath(relPath) {
  return extensionOf(relPath) === "svg";
}

// src/client/file-tree.ts
function buildFileTree(files, dirs = []) {
  const root = [];
  const dirNodes = /* @__PURE__ */ new Map();
  function ensureDir(dirPath) {
    if (dirPath === "") return root;
    const existing = dirNodes.get(dirPath);
    if (existing?.children) return existing.children;
    const parts = dirPath.split("/");
    const name2 = parts[parts.length - 1] ?? dirPath;
    const parentPath = parts.slice(0, -1).join("/");
    const siblings = ensureDir(parentPath);
    const node = { name: name2, path: dirPath, kind: "dir", children: [] };
    siblings.push(node);
    dirNodes.set(dirPath, node);
    return node.children ?? [];
  }
  for (const dirPath of dirs) ensureDir(dirPath);
  for (const file of files) {
    const parts = file.split("/");
    const name2 = parts[parts.length - 1] ?? file;
    const parent = parts.slice(0, -1).join("/");
    ensureDir(parent).push({ name: name2, path: file, kind: "file" });
  }
  function sortNodes(nodes) {
    nodes.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "dir" ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
    for (const node of nodes) {
      if (node.children) sortNodes(node.children);
    }
    return nodes;
  }
  return sortNodes(root);
}

// src/client/image-view.ts
var RAW_ENDPOINT = "/leanspec-viewer/raw";
function rawUrl(projectRoot, relPath) {
  const params = new URLSearchParams();
  if (projectRoot !== "") params.set("root", projectRoot);
  params.set("path", relPath);
  return `${RAW_ENDPOINT}?${params.toString()}`;
}
function viewModesFor(relPath) {
  const svg = relPath !== null && isSvgPath(relPath);
  return svg ? ["preview", "source", "edit"] : ["preview", "edit"];
}
function canEditFile(relPath) {
  return relPath === null || !isImagePath(relPath);
}
function shouldLoadText(relPath, mode) {
  if (relPath === null) return false;
  if (!isImagePath(relPath)) return true;
  return mode === "source";
}
function imageLoadErrorText(status, detail) {
  if (status === 0) return "\u56FE\u7247\u52A0\u8F7D\u5931\u8D25\uFF08\u7F51\u7EDC\u9519\u8BEF\uFF09\uFF0C\u8BF7\u91CD\u8BD5";
  if (status === 200) return "\u8FD9\u4E2A\u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684\u56FE\u7247";
  if (status === 413) return "\u56FE\u7247\u8FC7\u5927\uFF08\u8D85\u8FC7 20MB\uFF09\uFF0C\u672A\u52A0\u8F7D";
  if (status === 415) return "\u8FD9\u4E2A\u540E\u7F00\u4E0D\u5728\u53EF\u9884\u89C8\u7684\u56FE\u7247\u767D\u540D\u5355\u91CC";
  if (status === 403) return "\u6587\u4EF6\u4E0D\u5B58\u5728\u6216\u4E0D\u5728\u5F53\u524D\u9879\u76EE\u5185\uFF08HTTP 403\uFF09";
  if (status === 404) {
    return detail === void 0 ? "\u56FE\u7247\u7AEF\u70B9\u672A\u5C31\u7EEA\uFF08HTTP 404\uFF1A\u8DEF\u7531\u4E0D\u5B58\u5728\uFF09\u2014\u2014 \u5BBF\u4E3B\u53EF\u80FD\u8FD8\u5728\u7528\u65E7\u4EA7\u7269\uFF0C\u91CD\u542F\u540E\u518D\u8BD5" : `\u6587\u4EF6\u4E0D\u5B58\u5728\uFF08HTTP 404 \xB7 ${detail}\uFF09`;
  }
  return detail === void 0 ? `\u56FE\u7247\u52A0\u8F7D\u5931\u8D25\uFF08HTTP ${status}\uFF09` : `\u56FE\u7247\u52A0\u8F7D\u5931\u8D25\uFF08HTTP ${status} \xB7 ${detail}\uFF09`;
}

// node_modules/.pnpm/marked@18.1.1/node_modules/marked/lib/marked.esm.js
function B() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var y = B();
function V(a3) {
  y = a3;
}
var M = { exec: () => null };
function D(a3) {
  let e = [];
  return (t) => {
    let n = Math.max(0, Math.min(3, t - 1)), i = e[n];
    return i || (i = a3(n), e[n] = i), i;
  };
}
function h(a3, e = "") {
  let t = typeof a3 == "string" ? a3 : a3.source, n = { replace: (i, r) => {
    let o = typeof r == "string" ? r : r.source;
    return o = o.replace(x.caret, "$1"), t = t.replace(i, o), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var ze = ((a3 = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + a3);
  } catch {
    return false;
  }
})();
var x = { codeRemoveIndent: /^(?: {0,3}\t| {1,4})/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, endingSpaceTabChar: /[ \t]$/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, leadingSpaceTab: /^[ \t]+/, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, numericCharacterReference: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/, numericCharacterReferenceOrAmpersand: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (a3) => new RegExp(`^( {0,3}${a3})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: D((a3) => new RegExp(`^ {0,${a3}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: D((a3) => new RegExp(`^ {0,${a3}}((?:-[ 	]*){3,}|(?:_[ 	]*){3,}|(?:\\*[ 	]*){3,})(?:\\n+|$)`)), fencesBeginRegex: D((a3) => new RegExp(`^ {0,${a3}}(?:\`\`\`|~~~)`)), headingBeginRegex: D((a3) => new RegExp(`^ {0,${a3}}#`)), htmlBeginRegex: D((a3) => new RegExp(`^ {0,${a3}}(?:</?(?:${Q})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, "i")), blockquoteBeginRegex: D((a3) => new RegExp(`^ {0,${a3}}>`)) };
var Ee = /^(?:[ \t]*(?:\n|$))+/;
var Me = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var Ce = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var N = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var Ie = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var Y = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
var fe = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |fences|blockquote|heading|hr|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var me = h(fe).replace(/bull/g, Y).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var Be = h(fe).replace(/bull/g, Y).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var ee = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/;
var De = /^[^\n]+/;
var te = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
var qe = h(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", te).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var Ze = h(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, Y).getRegex();
var Q = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var ne = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var ve = h("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", ne).replace("tag", Q).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var xe = (a3) => h(ee).replace("hr", N).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", a3).replace("html", " {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)").replace("tag", Q).getRegex();
var He = xe(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/);
var Ge = xe(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/);
var Ne = h(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", Ge).getRegex();
var re = { blockquote: Ne, code: Me, def: qe, fences: Ce, heading: Ie, hr: N, html: ve, lheading: me, list: Ze, newline: Ee, paragraph: He, table: M, text: De };
var de = h("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", N).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", " {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)").replace("tag", Q).getRegex();
var Qe = { ...re, lheading: Be, table: de, paragraph: h(ee).replace("hr", N).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", de).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", " {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)").replace("tag", Q).getRegex() };
var je = { ...re, html: h(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", ne).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: M, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: h(ee).replace("hr", N).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", me).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() };
var Fe = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var Ue = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var be = /^( {2,}|\\)\n(?!\s*$)[ \t]*/;
var Ke = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var S = /[\p{P}\p{S}]/u;
var q = /[\s\p{P}\p{S}]/u;
var j = /[^\s\p{P}\p{S}]/u;
var Xe = h(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, q).getRegex();
var We = /[\p{Pi}\p{Ps}"']/u;
var Re = /(?!~)[\p{P}\p{S}]/u;
var Ve = /(?!~)[\s\p{P}\p{S}]/u;
var Je = /(?:[^\s\p{P}\p{S}]|~)/u;
var Ye = h(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", ze ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var Te = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
var et = h(Te, "u").replace(/punct/g, S).getRegex();
var tt = h(Te, "u").replace(/punct/g, Re).getRegex();
var nt = /^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/;
var rt = h(nt, "u").replace(/openQuote/g, We).replace(/punct/g, S).getRegex();
var Oe = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var st = h(Oe, "gu").replace(/notPunctSpace/g, j).replace(/punctSpace/g, q).replace(/punct/g, S).getRegex();
var it = h(Oe, "gu").replace(/notPunctSpace/g, Je).replace(/punctSpace/g, Ve).replace(/punct/g, Re).getRegex();
var ot = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)[\\s](\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)";
var at = h(ot, "gu").replace(/notPunctSpace/g, j).replace(/punctSpace/g, q).replace(/punct/g, S).getRegex();
var lt = h("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, j).replace(/punctSpace/g, q).replace(/punct/g, S).getRegex();
var ut = "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)[\\s](_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)";
var pt = h(ut, "gu").replace(/notPunctSpace/g, j).replace(/punctSpace/g, q).replace(/punct/g, S).getRegex();
var ct = h(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, S).getRegex();
var ht = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)";
var dt = h(ht, "gu").replace(/notPunctSpace/g, j).replace(/punctSpace/g, q).replace(/punct/g, S).getRegex();
var kt = h(/\\(punct)/, "gu").replace(/punct/g, S).getRegex();
var gt = h(/(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\(punct)/, "gu").replace(/punct/g, S).getRegex();
var ft = h(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var mt = h(ne).replace("(?:-->|$)", "-->").getRegex();
var xt = h("^comment|^</[a-zA-Z][a-zA-Z0-9-]*\\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", mt).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var we = /\[(?:\\[\s\S]|[^\[\]\\])*\]/;
var K = h(/(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/).replace("brackets", we).getRegex();
var bt = h(/^!?\[(label)\]\([ \t\n]*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?[ \t\n]*\)/).replace("label", K).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var Rt = h(/^!?\[(label)\]\[(ref)\]/).replace("label", K).replace("ref", te).getRegex();
var Tt = h(/^!?\[(ref)\](?:\[\])?/).replace("ref", te).getRegex();
var ke = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999}/;
var Ot = h(/(?:[^\[\]\\`]*(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?/).replace("brackets", we).getRegex();
var wt = h("reflink|nolink(?!\\()", "g").replace("reflink", h(/^!?\[(label)\]\[(ref)\]/).replace("label", Ot).replace("ref", ke).getRegex()).replace("nolink", h(/^!?\[(ref)\](?:\[\])?/).replace("ref", ke).getRegex()).getRegex();
var ge = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var Pt = /[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/;
var yt = h(/(?:mailto:email|xmpp:email(?:\/[A-Za-z0-9@.]+)?)/).replace(/email/g, Pt).getRegex();
var se = { _backpedal: M, anyPunctuation: kt, anyPunctuationOutsideCode: gt, autolink: ft, blockSkip: Ye, br: be, code: Ue, del: M, delLDelim: M, delRDelim: M, emStrongLDelim: et, emStrongRDelimAst: st, emStrongRDelimUnd: lt, escape: Fe, link: bt, nolink: Tt, punctuation: Xe, reflink: Rt, reflinkSearch: wt, tag: xt, text: Ke, url: M };
var St = { ...se, emStrongLDelim: rt, emStrongRDelimAst: at, emStrongRDelimUnd: pt, link: h(/^!?\[(label)\]\((.*?)\)/).replace("label", K).getRegex(), reflink: h(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", K).getRegex() };
var J = { ...se, emStrongRDelimAst: it, emStrongLDelim: tt, delLDelim: ct, delRDelim: dt, url: h(/^emailProtocol|^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("emailProtocol", yt).replace("protocol", ge).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: h(/^(?:[^a-zA-Z0-9](?=emailProtocol)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=emailProtocol)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/).replace("protocol", ge).replace(/emailProtocol/g, /(?:mailto|xmpp):/).getRegex() };
var _t = { ...J, br: h(be).replace("{2,}", "*").getRegex(), text: h(J.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var F = { normal: re, gfm: Qe, pedantic: je };
var Z = { normal: se, gfm: J, breaks: _t, pedantic: St };
var $t = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var Pe = (a3) => $t[a3];
function w(a3, e) {
  if (e) {
    if (x.escapeTest.test(a3)) return a3.replace(x.escapeReplace, Pe);
  } else if (x.escapeTestNoEncode.test(a3)) return a3.replace(x.escapeReplaceNoEncode, Pe);
  return a3;
}
function ye(a3) {
  return x.numericCharacterReference.test(a3) ? a3.replace(x.numericCharacterReferenceOrAmpersand, (e, t, n) => {
    if (t === void 0 && n === void 0) return "&amp;";
    let i = t === void 0 ? Number.parseInt(n, 16) : Number.parseInt(t, 10);
    return i === 0 || i > 1114111 || i >= 55296 && i <= 57343 ? "\uFFFD" : i === 38 ? "&amp;" : String.fromCodePoint(i);
  }) : a3;
}
function ie(a3) {
  try {
    a3 = encodeURI(a3).replace(x.percentDecode, "%");
  } catch {
    return null;
  }
  return a3;
}
function oe(a3, e) {
  let t = a3.replace(x.findPipe, (r, o, s) => {
    let l = false, u = o;
    for (; --u >= 0 && s[u] === "\\"; ) l = !l;
    return l ? "|" : " |";
  }), n = t.split(x.splitPipe), i = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e) if (n.length > e) n.splice(e);
  else for (; n.length < e; ) n.push("");
  for (; i < n.length; i++) n[i] = n[i].trim().replace(x.slashPipe, "|");
  return n;
}
function A(a3, e, t) {
  let n = a3.length;
  if (n === 0) return "";
  let i = 0;
  for (; i < n; ) {
    let r = a3.charAt(n - i - 1);
    if (r === e && !t) i++;
    else if (r !== e && t) i++;
    else break;
  }
  return a3.slice(0, n - i);
}
function ae(a3) {
  let e = a3.split(`
`), t = e.length - 1;
  for (; t >= 0 && x.blankLine.test(e[t]); ) t--;
  return e.length - t <= 2 ? a3 : e.slice(0, t + 1).join(`
`);
}
function v(a3) {
  return a3.trim().toLowerCase().toUpperCase().toLowerCase();
}
function le(a3, e) {
  if (a3.indexOf(e[0]) === -1 && a3.indexOf(e[1]) === -1) return -1;
  let t = 0;
  for (let n = 0; n < a3.length; n++) if (a3[n] === "\\") n++;
  else if (a3[n] === e[0]) t++;
  else if (a3[n] === e[1] && (t--, t < 0)) return n;
  return t > 0 ? -2 : -1;
}
function X(a3, e = 0) {
  let t = e, n = "";
  for (let i of a3) if (i === "	") {
    let r = 4 - t % 4;
    n += " ".repeat(r), t += r;
  } else n += i, t++;
  return n;
}
function Se(a3, e, t, n, i) {
  let r = e.href, o = e.title || null, s = a3[1].replace(i.other.outputLinkReplace, "$1"), l = a3[0].charAt(0) === "!", u = n.state.inLink, c = n.state.linkEmitted, p = n.state.inRawBlock;
  n.state.inLink = true, n.state.linkEmitted = false;
  let d = n.inlineTokens(s), g = n.state.linkEmitted;
  if (n.state.linkEmitted = c, n.state.inLink = u, !l) {
    if (g) {
      n.state.inRawBlock = p;
      return;
    }
    n.state.linkEmitted = true;
  }
  return { type: l ? "image" : "link", raw: t, href: r, title: o, text: s, tokens: d };
}
function Lt(a3, e, t) {
  let n = a3.match(t.other.indentCodeCompensation);
  if (n === null) return e;
  let i = n[1];
  return e.split(`
`).map((r) => {
    let o = r.match(t.other.beginningSpace);
    if (o === null) return r;
    let [s] = o;
    return r.slice(Math.min(s.length, i.length));
  }).join(`
`);
}
function _e(a3, e, t, n) {
  if (!e.includes("<")) return false;
  for (let i = 0; i < e.length; i++) {
    if (e[i] === "\\") {
      i++;
      continue;
    }
    if (e[i] === "`") {
      let s = n.inline.code.exec(e.slice(i));
      if (s) {
        i += s[0].length - 1;
        continue;
      }
    }
    if (e[i] !== "<") continue;
    let r = a3.slice(t + i), o = n.inline.tag.exec(r) || n.inline.autolink.exec(r);
    if (o) {
      if (o[0].length > e.length - i) return true;
      i += o[0].length - 1;
    }
  }
  return false;
}
var _ = class {
  options;
  rules;
  lexer;
  constructor(e) {
    this.options = e || y;
  }
  space(e) {
    let t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0) return { type: "space", raw: t[0] };
  }
  code(e) {
    let t = this.rules.block.code.exec(e);
    if (t) {
      let n = this.options.pedantic ? t[0] : ae(t[0]), i = n.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: n, codeBlockStyle: "indented", text: i };
    }
  }
  fences(e) {
    let t = this.rules.block.fences.exec(e);
    if (t) {
      let n = t[0], i = Lt(n, t[3] || "", this.rules);
      return { type: "code", raw: n, lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2], text: i };
    }
  }
  heading(e) {
    let t = this.rules.block.heading.exec(e);
    if (t) {
      let n = t[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let i = A(n, "#");
        (this.options.pedantic || !i || this.rules.other.endingSpaceTabChar.test(i)) && (n = i.trim());
      }
      return { type: "heading", raw: A(t[0], `
`), depth: t[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(e) {
    let t = this.rules.block.hr.exec(e);
    if (t) return { type: "hr", raw: A(t[0], `
`) };
  }
  blockquote(e) {
    let t = this.rules.block.blockquote.exec(e);
    if (t) {
      let n = A(t[0], `
`).split(`
`), i = "", r = "", o = [];
      for (; n.length > 0; ) {
        let s = false, l = [], u;
        for (u = 0; u < n.length; u++) if (this.rules.other.blockquoteStart.test(n[u])) l.push(n[u]), s = true;
        else if (!s) l.push(n[u]);
        else break;
        n = n.slice(u);
        let c = l.join(`
`), p = c.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        i = i ? `${i}
${c}` : c, r = r ? `${r}
${p}` : p;
        let d = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(p, o, true), this.lexer.state.top = d, n.length === 0) break;
        let g = o.at(-1);
        if (g?.type === "code" || g?.type === "heading" || g?.type === "hr" || g?.type === "html") break;
        if (g?.type === "blockquote") {
          let k = g, P = n.join(`
`), R = k.raw + `
` + P.replace(this.rules.other.blockquoteSetextReplace2, ""), m = this.blockquote(R);
          o[o.length - 1] = m;
          let E = R.substring(m.raw.length).replace(/^\n/, ""), b = E ? E.split(`
`).length : 0, H = b ? n.slice(0, -b) : n;
          H.length > 0 && (i = `${i}
${H.join(`
`)}`), r = r.substring(0, r.length - k.text.length) + m.text;
          break;
        } else if (g?.type === "list") {
          let k = g, P = k.raw + `
` + n.join(`
`), R = this.list(P);
          o[o.length - 1] = R, i = i.substring(0, i.length - g.raw.length) + R.raw, r = r.substring(0, r.length - k.raw.length) + R.raw, n = P.substring(o.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: i, tokens: o, text: r };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      let n = e, i = () => n.length - e.length, r = t[1].trim(), o = r.length > 1, s = { type: "list", raw: "", ordered: o, start: o ? +r.slice(0, -1) : "", loose: false, items: [] };
      r = o ? `\\d{1,9}\\${r.slice(-1)}` : `\\${r}`, this.options.pedantic && (r = o ? r : "[*+-]");
      let l = this.rules.other.listItemRegex(r), u = false;
      for (; e; ) {
        let p = false, d = "";
        if (!(t = l.exec(e)) || this.rules.block.hr.test(e)) break;
        let g = i();
        e = e.substring(t[0].length);
        let k = t[2].split(`
`, 1)[0], P = t[1].length, R = this.options.pedantic ? X(k, P) : k.replace(this.rules.other.leadingSpaceTab, (W) => X(W, P)), m = e.split(`
`, 1)[0], E = !R.trim(), b = 0;
        if (this.options.pedantic ? (b = 2, d = R.trimStart()) : E ? b = P + 1 : (b = R.search(this.rules.other.nonSpaceChar), b = b > 4 ? 1 : b, d = R.slice(b), b += P), E && this.rules.other.blankLine.test(m) && (e = e.substring(m.length + 1), p = true), !p) {
          let W = this.rules.other.nextBulletRegex(b), ue = this.rules.other.hrRegex(b), pe = this.rules.other.fencesBeginRegex(b), ce = this.rules.other.headingBeginRegex(b), $e = this.rules.other.htmlBeginRegex(b), Le = this.rules.other.blockquoteBeginRegex(b);
          for (; e; ) {
            let he = e.split(`
`, 1)[0], G;
            if (m = he, this.options.pedantic ? (m = m.replace(this.rules.other.listReplaceNesting, "  "), G = m) : G = m.replace(this.rules.other.leadingSpaceTab, (Ae) => X(Ae)), pe.test(m) || ce.test(m) || $e.test(m) || Le.test(m) || W.test(m) || ue.test(m)) break;
            if (G.search(this.rules.other.nonSpaceChar) >= b || !m.trim()) d += `
` + G.slice(b);
            else {
              if (E || R.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || pe.test(R) || ce.test(R) || ue.test(R)) break;
              d += `
` + m;
            }
            E = !m.trim(), e = e.substring(he.length + 1), R = G.slice(b);
          }
        }
        let H = n.slice(g, i());
        s.loose || (u ? s.loose = true : this.rules.other.doubleBlankLine.test(H) && (u = true)), s.items.push({ type: "list_item", raw: H, task: !!this.options.gfm && this.rules.other.listIsTask.test(d), loose: false, text: d, tokens: [] });
      }
      let c = s.items.at(-1);
      if (c) c.raw = c.raw.trimEnd(), c.text = c.text.trimEnd();
      else return;
      s.raw = n.slice(0, i()).trimEnd();
      for (let p of s.items) if (this.lexer.state.top = false, p.tokens = this.lexer.blockTokens(p.text, []), !s.loose) {
        let d = p.tokens.filter((k) => k.type === "space"), g = d.length > 0 && d.some((k) => this.rules.other.anyLine.test(k.raw));
        s.loose = g;
      }
      for (let p of s.items) {
        let d = p.tokens[0];
        if (p.task && (d?.type === "text" || d?.type === "paragraph")) {
          p.text = p.text.replace(this.rules.other.listReplaceTask, ""), d.raw = d.raw.replace(this.rules.other.listReplaceTask, ""), d.text = d.text.replace(this.rules.other.listReplaceTask, "");
          for (let k = this.lexer.inlineQueue.length - 1; k >= 0; k--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[k].src)) {
            this.lexer.inlineQueue[k].src = this.lexer.inlineQueue[k].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let g = this.rules.other.listTaskCheckbox.exec(p.raw);
          if (g) {
            let k = { type: "checkbox", raw: g[0] + " ", checked: g[0] !== "[ ]" };
            p.checked = k.checked, s.loose ? p.tokens[0] && ["paragraph", "text"].includes(p.tokens[0].type) && "tokens" in p.tokens[0] && p.tokens[0].tokens ? (p.tokens[0].raw = k.raw + p.tokens[0].raw, p.tokens[0].text = k.raw + p.tokens[0].text, p.tokens[0].tokens.unshift(k)) : p.tokens.unshift({ type: "paragraph", raw: k.raw, text: k.raw, tokens: [k] }) : p.tokens.unshift(k);
          }
        } else p.task && (p.task = false);
      }
      if (s.loose) for (let p of s.items) {
        p.loose = true;
        for (let d of p.tokens) d.type === "text" && (d.type = "paragraph");
      }
      return s;
    }
  }
  html(e) {
    let t = this.rules.block.html.exec(e);
    if (t) {
      let n = ae(t[0]);
      return { type: "html", block: true, raw: n, pre: t[1] === "pre" || t[1] === "script" || t[1] === "style", text: n };
    }
  }
  def(e) {
    let t = this.rules.block.def.exec(e);
    if (t) {
      if (!this.rules.other.startAngleBracket.test(t[2]) && le(t[2], "()") !== -1) return;
      let n = v(t[1]).replace(this.rules.other.multipleSpaceGlobal, " "), i = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return { type: "def", tag: n, raw: A(t[0], `
`), href: i, title: r };
    }
  }
  table(e) {
    let t = this.rules.block.table.exec(e);
    if (!t || !this.rules.other.tableDelimiter.test(t[2])) return;
    let n = oe(t[1]), i = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), r = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], o = { type: "table", raw: A(t[0], `
`), header: [], align: [], rows: [] };
    if (n.length === i.length) {
      for (let s of i) this.rules.other.tableAlignRight.test(s) ? o.align.push("right") : this.rules.other.tableAlignCenter.test(s) ? o.align.push("center") : this.rules.other.tableAlignLeft.test(s) ? o.align.push("left") : o.align.push(null);
      for (let s = 0; s < n.length; s++) o.header.push({ text: n[s], tokens: this.lexer.inline(n[s]), header: true, align: o.align[s] });
      for (let s of r) o.rows.push(oe(s, o.header.length).map((l, u) => ({ text: l, tokens: this.lexer.inline(l), header: false, align: o.align[u] })));
      return o;
    }
  }
  lheading(e) {
    let t = this.rules.block.lheading.exec(e);
    if (t) {
      let n = t[1].trim();
      return { type: "heading", raw: A(t[0], `
`), depth: t[2].charAt(0) === "=" ? 1 : 2, text: n, tokens: this.lexer.inline(n) };
    }
  }
  paragraph(e) {
    let t = this.rules.block.paragraph.exec(e);
    if (t) {
      let n = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
      return { type: "paragraph", raw: t[0], text: n, tokens: this.lexer.inline(n) };
    }
  }
  text(e) {
    let t = this.rules.block.text.exec(e);
    if (t) return { type: "text", raw: t[0], text: t[0], tokens: this.lexer.inline(t[0]) };
  }
  escape(e) {
    let t = this.rules.inline.escape.exec(e);
    if (t) return { type: "escape", raw: t[0], text: t[1] };
  }
  tag(e) {
    let t = this.rules.inline.tag.exec(e);
    if (t) return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t[0] };
  }
  link(e) {
    if (this.lexer.state.linkParenPossible === false) return;
    let t = this.rules.inline.link.exec(e);
    if (t) {
      let n = t[0].charAt(0) === "!" ? 2 : 1;
      if (!this.options.pedantic && _e(e, t[1], n, this.rules)) return;
      let i = t[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(i)) {
        if (!this.rules.other.endAngleBracket.test(i)) return;
        let s = A(i.slice(0, -1), "\\");
        if ((i.length - s.length) % 2 === 0) return;
      } else {
        let s = le(t[2], "()");
        if (s === -2) return;
        if (s > -1) {
          let u = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + s;
          t[2] = t[2].substring(0, s), t[0] = t[0].substring(0, u).trim(), t[3] = "";
        }
      }
      let r = t[2], o = "";
      if (this.options.pedantic) {
        let s = this.rules.other.pedanticHrefTitle.exec(r);
        s && (r = s[1], o = s[3]);
      } else o = t[3] ? t[3].slice(1, -1) : "";
      return r = r.trim(), this.rules.other.startAngleBracket.test(r) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(i) ? r = r.slice(1) : r = r.slice(1, -1)), Se(t, { href: r && r.replace(this.rules.inline.anyPunctuation, "$1"), title: o && o.replace(this.rules.inline.anyPunctuation, "$1") }, t[0], this.lexer, this.rules);
    }
  }
  reflink(e, t) {
    let n;
    if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
      let i = n[0].charAt(0) === "!" ? 2 : 1;
      if (!this.options.pedantic && _e(e, n[1], i, this.rules)) return;
      let r = (n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " "), o = t[v(r)];
      if (!o) {
        let s = n[0].charAt(0);
        return { type: "text", raw: s, text: s };
      }
      return Se(n, o, n[0], this.lexer, this.rules);
    }
  }
  emStrong(e, t, n = "") {
    let i = this.rules.inline.emStrongLDelim.exec(e);
    if (!i || !i[1] && !i[2] && !i[3] && !i[4] || i[4] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
    if (!(i[1] || i[3] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let o = [...i[0]].length - 1, s, l, u = o, c = 0, p = i[0][0], d = n === p, g = p === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (g.lastIndex = 0, t = t.slice(-1 * e.length + o); (i = g.exec(t)) !== null; ) {
        if (s = i[1] || i[2] || i[3] || i[4] || i[5] || i[6], !s) continue;
        if (l = [...s].length, i[3] || i[4]) {
          u += l;
          continue;
        } else if (i[5] || i[6]) {
          if (o % 3 && !((o + l) % 3)) {
            c += l;
            continue;
          }
          if (d) break;
        }
        if (u -= l, u > 0) continue;
        l = Math.min(l, l + u + c);
        let k = [...i[0]][0].length, P = e.slice(0, o + i.index + k + l);
        if (Math.min(o, l) % 2) {
          let m = P.slice(1, -1);
          return { type: "em", raw: P, text: m, tokens: this.lexer.inlineTokens(m) };
        }
        let R = P.slice(2, -2);
        return { type: "strong", raw: P, text: R, tokens: this.lexer.inlineTokens(R) };
      }
    }
  }
  codespan(e) {
    let t = this.rules.inline.code.exec(e);
    if (t) {
      let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), i = this.rules.other.nonSpaceChar.test(n), r = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return i && r && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: t[0], text: n };
    }
  }
  br(e) {
    let t = this.rules.inline.br.exec(e);
    if (t) return { type: "br", raw: t[0] };
  }
  del(e, t, n = "") {
    let i = this.rules.inline.delLDelim.exec(e);
    if (!i) return;
    if (!(i[1] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let o = [...i[0]].length - 1, s, l, u = o, c = this.rules.inline.delRDelim;
      for (c.lastIndex = 0, t = t.slice(-1 * e.length + o); (i = c.exec(t)) !== null; ) {
        if (s = i[1] || i[2] || i[3] || i[4] || i[5] || i[6], !s || (l = [...s].length, l !== o)) continue;
        if (i[3] || i[4]) {
          u += l;
          continue;
        }
        if (u -= l, u > 0) continue;
        l = Math.min(l, l + u);
        let p = [...i[0]][0].length, d = e.slice(0, o + i.index + p + l), g = d.slice(o, -o);
        return { type: "del", raw: d, text: g, tokens: this.lexer.inlineTokens(g) };
      }
    }
  }
  autolink(e) {
    let t = this.rules.inline.autolink.exec(e);
    if (t) {
      let n, i;
      return t[2] === "@" ? (n = t[1], i = "mailto:" + n) : (n = t[1], i = n), { type: "link", raw: t[0], text: n, href: i, autolink: true, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(e) {
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let n, i;
      if (t[2] === "@") n = t[0], i = "mailto:" + n;
      else {
        let r;
        do
          r = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
        while (r !== t[0]);
        n = t[0], t[1] === "www." ? i = "http://" + t[0] : i = t[0];
      }
      return { type: "link", raw: t[0], text: n, href: i, autolink: true, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(e) {
    let t = this.rules.inline.text.exec(e);
    if (t) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: t[0], text: n ? t[0] : ye(t[0]), escaped: n };
    }
  }
};
var T = class a {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(e) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e || y, this.options.tokenizer = this.options.tokenizer || new _(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, linkEmitted: false, linkParenPossible: true, top: true };
    let t = { other: x, block: F.normal, inline: Z.normal };
    this.options.pedantic ? (t.block = F.pedantic, t.inline = Z.pedantic) : this.options.gfm && (t.block = F.gfm, this.options.breaks ? t.inline = Z.breaks : t.inline = Z.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: F, inline: Z };
  }
  static lex(e, t) {
    return new a(t).lex(e);
  }
  static lexInline(e, t) {
    return new a(t).inlineTokens(e);
  }
  lex(e) {
    e = e.replace(x.carriageReturn, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0; t < this.inlineQueue.length; t++) {
      let n = this.inlineQueue[t];
      this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], n = false) {
    this.tokenizer.lexer = this, this.options.pedantic && (e = e.replace(x.tabCharGlobal, "    ").replace(x.spaceLine, ""));
    let i = 1 / 0;
    for (; e; ) {
      if (e.length < i) i = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      let r;
      if (this.options.extensions?.block?.some((s) => (r = s.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), true) : false)) continue;
      if (r = this.tokenizer.space(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        r.raw.length === 1 && s !== void 0 ? s.raw += `
` : t.push(r);
        continue;
      }
      if (r = this.tokenizer.code(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "paragraph" || s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.at(-1).src = s.text) : t.push(r);
        continue;
      }
      if (r = this.tokenizer.fences(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.heading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.hr(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.blockquote(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.list(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.html(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.def(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "paragraph" || s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.raw, this.inlineQueue.at(-1).src = s.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = { href: r.href, title: r.title }, t.push(r));
        continue;
      }
      if (r = this.tokenizer.table(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.lheading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      let o = e;
      if (this.options.extensions?.startBlock) {
        let s = 1 / 0, l = e.slice(1), u;
        this.options.extensions.startBlock.forEach((c) => {
          u = c.call({ lexer: this }, l), typeof u == "number" && u >= 0 && (s = Math.min(s, u));
        }), s < 1 / 0 && s >= 0 && (o = e.substring(0, s + 1));
      }
      if (this.state.top && (r = this.tokenizer.paragraph(o))) {
        let s = t.at(-1);
        n && s?.type === "paragraph" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = s.text) : t.push(r), n = o.length !== e.length, e = e.substring(r.raw.length);
        continue;
      }
      if (r = this.tokenizer.text(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = s.text) : t.push(r);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return this.state.top = true, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  linkInText(e) {
    if (!e.includes("[")) return false;
    let t = this.tokenizer.rules.inline.link;
    for (let n of e.matchAll(this.tokenizer.rules.inline.blockSkip)) if (t.test(n[0]) && e.charAt(n.index - 1) !== "!") return true;
    for (let n of e.matchAll(this.tokenizer.rules.inline.reflinkSearch)) {
      let i = n[0], r = i.lastIndexOf("[");
      if (!(i.charAt(0) === "!" || !Object.hasOwn(this.tokens.links, v(i.slice(r + 1, -1)))) && !(r > 1 && this.linkInText(i.slice(1, r - 1)))) return true;
    }
    return false;
  }
  inlineTokens(e, t = []) {
    this.tokenizer.lexer = this;
    let n = this.state.linkParenPossible;
    this.state.linkParenPossible = n && e.includes(")");
    try {
      return this.#e(e, t);
    } finally {
      this.state.linkParenPossible = n;
    }
  }
  #e(e, t) {
    let n = e;
    if (this.tokens.links && e.includes("[")) {
      let s = this.tokenizer.rules.inline.reflinkSearch, l = (u) => {
        let c = u.lastIndexOf("[");
        if (!Object.hasOwn(this.tokens.links, v(u.slice(c + 1, -1)))) return u;
        if (c > 1 && u.charAt(0) !== "!") {
          let p = u.slice(1, c - 1);
          if (this.linkInText(p)) return "[" + p.replace(s, l) + "][" + "a".repeat(u.length - c - 2) + "]";
        }
        return "[" + "a".repeat(u.length - 2) + "]";
      };
      n = n.replace(s, l);
    }
    n = n.replace(this.tokenizer.rules.inline.anyPunctuationOutsideCode, (s, l, u) => u ? "+".repeat(s.length) : l ? l + s.slice(l.length, -l.length).replace(/`/g, "+") + l : s), n = n.replace(this.tokenizer.rules.inline.blockSkip, (s, l, u) => {
      let c = u ? u.length : 0;
      return s.slice(0, c) + "[" + "a".repeat(s.length - c - 2) + "]";
    }), n = this.options.hooks?.emStrongMask?.call({ lexer: this }, n) ?? n;
    let i = false, r = "", o = 1 / 0;
    for (; e; ) {
      if (e.length < o) o = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      i || (r = ""), i = false;
      let s;
      if (this.options.extensions?.inline?.some((u) => (s = u.call({ lexer: this }, e, t)) ? (e = e.substring(s.raw.length), t.push(s), true) : false)) continue;
      if (s = this.tokenizer.escape(e)) {
        e = e.substring(s.raw.length), t.push(s);
        continue;
      }
      if (s = this.tokenizer.tag(e)) {
        e = e.substring(s.raw.length), t.push(s);
        continue;
      }
      if (s = this.tokenizer.link(e)) {
        e = e.substring(s.raw.length), t.push(s);
        continue;
      }
      if (s = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(s.raw.length);
        let u = t.at(-1);
        s.type === "text" && u?.type === "text" ? (u.raw += s.raw, u.text += s.text) : t.push(s);
        continue;
      }
      if (s = this.tokenizer.emStrong(e, n, r)) {
        e = e.substring(s.raw.length), t.push(s);
        continue;
      }
      if (s = this.tokenizer.codespan(e)) {
        e = e.substring(s.raw.length), t.push(s);
        continue;
      }
      if (s = this.tokenizer.br(e)) {
        e = e.substring(s.raw.length), t.push(s);
        continue;
      }
      if (s = this.tokenizer.del(e, n, r)) {
        e = e.substring(s.raw.length), t.push(s);
        continue;
      }
      if (s = this.tokenizer.autolink(e)) {
        e = e.substring(s.raw.length), t.push(s);
        continue;
      }
      if (!this.state.inLink && (s = this.tokenizer.url(e))) {
        e = e.substring(s.raw.length), t.push(s);
        continue;
      }
      let l = e;
      if (this.options.extensions?.startInline) {
        let u = 1 / 0, c = e.slice(1), p;
        this.options.extensions.startInline.forEach((d) => {
          p = d.call({ lexer: this }, c), typeof p == "number" && p >= 0 && (u = Math.min(u, p));
        }), u < 1 / 0 && u >= 0 && (l = e.substring(0, u + 1));
      }
      if (s = this.tokenizer.inlineText(l)) {
        e = e.substring(s.raw.length), s.raw.slice(-1) !== "_" && (r = s.raw.slice(-1)), i = true;
        let u = t.at(-1);
        u?.type === "text" ? (u.raw += s.raw, u.text += s.text) : t.push(s);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return t;
  }
  infiniteLoopError(e) {
    let t = "Infinite loop on byte: " + e;
    if (this.options.silent) console.error(t);
    else throw new Error(t);
  }
};
var $ = class {
  options;
  parser;
  constructor(e) {
    this.options = e || y;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: n }) {
    let i = (t || "").match(x.notSpaceStart)?.[0], r = e ? e.replace(x.endingNewline, "") + `
` : "";
    return i ? '<pre><code class="language-' + w(i) + '">' + (n ? r : w(r, true)) + `</code></pre>
` : "<pre><code>" + (n ? r : w(r, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e }) {
    return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
  }
  html({ text: e }) {
    return e;
  }
  def(e) {
    return "";
  }
  heading({ tokens: e, depth: t }) {
    return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
  }
  hr(e) {
    return `<hr>
`;
  }
  list(e) {
    let t = e.ordered, n = e.start, i = "";
    for (let s = 0; s < e.items.length; s++) {
      let l = e.items[s];
      i += this.listitem(l);
    }
    let r = t ? "ol" : "ul", o = t && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + r + o + `>
` + i + "</" + r + `>
`;
  }
  listitem(e) {
    return `<li>${this.parser.parse(e.tokens)}</li>
`;
  }
  checkbox({ checked: e }) {
    return "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e }) {
    return `<p>${this.parser.parseInline(e)}</p>
`;
  }
  table(e) {
    let t = "", n = "";
    for (let r = 0; r < e.header.length; r++) n += this.tablecell(e.header[r]);
    t += this.tablerow({ text: n });
    let i = "";
    for (let r = 0; r < e.rows.length; r++) {
      let o = e.rows[r];
      n = "";
      for (let s = 0; s < o.length; s++) n += this.tablecell(o[s]);
      i += this.tablerow({ text: n });
    }
    return i && (i = `<tbody>${i}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + i + `</table>
`;
  }
  tablerow({ text: e }) {
    return `<tr>
${e}</tr>
`;
  }
  tablecell(e) {
    let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
    return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
`;
  }
  strong({ tokens: e }) {
    return `<strong>${this.parser.parseInline(e)}</strong>`;
  }
  em({ tokens: e }) {
    return `<em>${this.parser.parseInline(e)}</em>`;
  }
  codespan({ text: e }) {
    return `<code>${w(e, true)}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, text: n, tokens: i, autolink: r }) {
    let o = r ? w(n, true) : this.parser.parseInline(i), s = ie(e);
    if (s === null) return o;
    e = w(s, r);
    let l = '<a href="' + e + '"';
    return t && (l += ' title="' + w(t) + '"'), l += ">" + o + "</a>", l;
  }
  image({ href: e, title: t, text: n, tokens: i }) {
    i && (n = this.parser.parseInline(i, this.parser.textRenderer));
    let r = ie(e);
    if (r === null) return w(n);
    e = r;
    let o = `<img src="${w(e)}" alt="${w(n)}"`;
    return t && (o += ` title="${w(t)}"`), o += ">", o;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : "escaped" in e && e.escaped ? e.text : w(e.text);
  }
};
var z = class {
  strong({ text: e }) {
    return e;
  }
  em({ text: e }) {
    return e;
  }
  codespan({ text: e }) {
    return e;
  }
  del({ text: e }) {
    return e;
  }
  html({ text: e }) {
    return e;
  }
  text({ text: e }) {
    return e;
  }
  link({ text: e }) {
    return "" + e;
  }
  image({ text: e }) {
    return "" + e;
  }
  br() {
    return "";
  }
  checkbox({ raw: e }) {
    return e;
  }
};
var O = class a2 {
  options;
  renderer;
  textRenderer;
  constructor(e) {
    this.options = e || y, this.options.renderer = this.options.renderer || new $(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new z();
  }
  static parse(e, t) {
    return new a2(t).parse(e);
  }
  static parseInline(e, t) {
    return new a2(t).parseInline(e);
  }
  parse(e) {
    this.renderer.parser = this;
    let t = "";
    for (let n = 0; n < e.length; n++) {
      let i = e[n];
      if (this.options.extensions?.renderers?.[i.type]) {
        let o = i, s = this.options.extensions.renderers[o.type].call({ parser: this }, o);
        if (s !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "checkbox", "html", "def", "paragraph", "text"].includes(o.type)) {
          t += s || "";
          continue;
        }
      }
      let r = i;
      switch (r.type) {
        case "space": {
          t += this.renderer.space(r);
          break;
        }
        case "hr": {
          t += this.renderer.hr(r);
          break;
        }
        case "heading": {
          t += this.renderer.heading(r);
          break;
        }
        case "code": {
          t += this.renderer.code(r);
          break;
        }
        case "table": {
          t += this.renderer.table(r);
          break;
        }
        case "blockquote": {
          t += this.renderer.blockquote(r);
          break;
        }
        case "list": {
          t += this.renderer.list(r);
          break;
        }
        case "checkbox": {
          t += this.renderer.checkbox(r);
          break;
        }
        case "html": {
          t += this.renderer.html(r);
          break;
        }
        case "def": {
          t += this.renderer.def(r);
          break;
        }
        case "paragraph": {
          t += this.renderer.paragraph(r);
          break;
        }
        case "text": {
          t += this.renderer.text(r);
          break;
        }
        default: {
          let o = 'Token with "' + r.type + '" type was not found.';
          if (this.options.silent) return console.error(o), "";
          throw new Error(o);
        }
      }
    }
    return t;
  }
  parseInline(e, t = this.renderer) {
    this.renderer.parser = this;
    let n = "";
    for (let i = 0; i < e.length; i++) {
      let r = e[i];
      if (this.options.extensions?.renderers?.[r.type]) {
        let s = this.options.extensions.renderers[r.type].call({ parser: this }, r);
        if (s !== false || !["escape", "html", "link", "image", "checkbox", "strong", "em", "codespan", "br", "del", "text"].includes(r.type)) {
          n += s || "";
          continue;
        }
      }
      let o = r;
      switch (o.type) {
        case "escape": {
          n += t.text(o);
          break;
        }
        case "html": {
          n += t.html(o);
          break;
        }
        case "link": {
          n += t.link(o);
          break;
        }
        case "image": {
          n += t.image(o);
          break;
        }
        case "checkbox": {
          n += t.checkbox(o);
          break;
        }
        case "strong": {
          n += t.strong(o);
          break;
        }
        case "em": {
          n += t.em(o);
          break;
        }
        case "codespan": {
          n += t.codespan(o);
          break;
        }
        case "br": {
          n += t.br(o);
          break;
        }
        case "del": {
          n += t.del(o);
          break;
        }
        case "text": {
          n += t.text(o);
          break;
        }
        default: {
          let s = 'Token with "' + o.type + '" type was not found.';
          if (this.options.silent) return console.error(s), "";
          throw new Error(s);
        }
      }
    }
    return n;
  }
};
var L = class {
  options;
  block;
  constructor(e) {
    this.options = e || y;
  }
  static passThroughHooks = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"]);
  static passThroughHooksRespectAsync = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"]);
  preprocess(e) {
    return e;
  }
  postprocess(e) {
    return e;
  }
  processAllTokens(e) {
    return e;
  }
  emStrongMask(e) {
    return e;
  }
  provideLexer(e = this.block) {
    return e ? T.lex : T.lexInline;
  }
  provideParser(e = this.block) {
    return e ? O.parse : O.parseInline;
  }
};
function C(a3, e) {
  if (Array.isArray(e)) for (let t = 0; t < e.length; t++) a3.push(e[t]);
  else a3.push(e);
}
var U = class {
  defaults = B();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = O;
  Renderer = $;
  TextRenderer = z;
  Lexer = T;
  Tokenizer = _;
  Hooks = L;
  constructor(...e) {
    this.use(...e);
  }
  walkTokens(e, t) {
    let n = [];
    for (let i of e) switch (C(n, t.call(this, i)), i.type) {
      case "table": {
        let r = i;
        for (let o of r.header) C(n, this.walkTokens(o.tokens, t));
        for (let o of r.rows) for (let s of o) C(n, this.walkTokens(s.tokens, t));
        break;
      }
      case "list": {
        let r = i;
        C(n, this.walkTokens(r.items, t));
        break;
      }
      default: {
        let r = i;
        this.defaults.extensions?.childTokens?.[r.type] ? this.defaults.extensions.childTokens[r.type].forEach((o) => {
          let s = r[o].flat(1 / 0);
          C(n, this.walkTokens(s, t));
        }) : r.tokens && C(n, this.walkTokens(r.tokens, t));
      }
    }
    return n;
  }
  use(...e) {
    let t = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e.forEach((n) => {
      let i = { ...n };
      if (i.async = this.defaults.async || i.async || false, n.extensions && (n.extensions.forEach((r) => {
        if (!r.name) throw new Error("extension name required");
        if ("renderer" in r) {
          let o = t.renderers[r.name];
          o ? t.renderers[r.name] = function(...s) {
            let l = r.renderer.apply(this, s);
            return l === false && (l = o.apply(this, s)), l;
          } : t.renderers[r.name] = r.renderer;
        }
        if ("tokenizer" in r) {
          if (!r.level || r.level !== "block" && r.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let o = t[r.level];
          o ? o.unshift(r.tokenizer) : t[r.level] = [r.tokenizer], r.start && (r.level === "block" ? t.startBlock ? t.startBlock.push(r.start) : t.startBlock = [r.start] : r.level === "inline" && (t.startInline ? t.startInline.push(r.start) : t.startInline = [r.start]));
        }
        "childTokens" in r && r.childTokens && (t.childTokens[r.name] = r.childTokens);
      }), i.extensions = t), n.renderer) {
        let r = this.defaults.renderer || new $(this.defaults);
        for (let o in n.renderer) {
          if (!(o in r)) throw new Error(`renderer '${o}' does not exist`);
          if (["options", "parser"].includes(o)) continue;
          let s = o, l = n.renderer[s], u = r[s];
          r[s] = (...c) => {
            let p = l.apply(r, c);
            return p === false && (p = u.apply(r, c)), p || "";
          };
        }
        i.renderer = r;
      }
      if (n.tokenizer) {
        let r = this.defaults.tokenizer || new _(this.defaults);
        for (let o in n.tokenizer) {
          if (!(o in r)) throw new Error(`tokenizer '${o}' does not exist`);
          if (["options", "rules", "lexer"].includes(o)) continue;
          let s = o, l = n.tokenizer[s], u = r[s];
          r[s] = (...c) => {
            let p = l.apply(r, c);
            return p === false && (p = u.apply(r, c)), p;
          };
        }
        i.tokenizer = r;
      }
      if (n.hooks) {
        let r = this.defaults.hooks || new L();
        for (let o in n.hooks) {
          if (!(o in r)) throw new Error(`hook '${o}' does not exist`);
          if (["options", "block"].includes(o)) continue;
          let s = o, l = n.hooks[s], u = r[s];
          L.passThroughHooks.has(o) ? r[s] = (c) => {
            if (this.defaults.async && L.passThroughHooksRespectAsync.has(o)) return (async () => {
              let d = await l.call(r, c);
              return u.call(r, d);
            })();
            let p = l.call(r, c);
            return u.call(r, p);
          } : r[s] = (...c) => {
            if (this.defaults.async) return (async () => {
              let d = await l.apply(r, c);
              return d === false && (d = await u.apply(r, c)), d;
            })();
            let p = l.apply(r, c);
            return p === false && (p = u.apply(r, c)), p;
          };
        }
        i.hooks = r;
      }
      if (n.walkTokens) {
        let r = this.defaults.walkTokens, o = n.walkTokens;
        i.walkTokens = function(s) {
          let l = [];
          return l.push(o.call(this, s)), r && C(l, r.call(this, s)), l;
        };
      }
      this.defaults = { ...this.defaults, ...i };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return T.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return O.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (n, i) => {
      let r = { ...i }, o = { ...this.defaults, ...r }, s = this.onError(!!o.silent, !!o.async);
      if (this.defaults.async === true && r.async === false) return s(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n > "u" || n === null) return s(new Error("marked(): input parameter is undefined or null"));
      if (typeof n != "string") return s(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
      if (o.hooks && (o.hooks.options = o, o.hooks.block = e), o.async) return (async () => {
        let l = o.hooks ? await o.hooks.preprocess(n) : n, c = await (o.hooks ? await o.hooks.provideLexer(e) : e ? T.lex : T.lexInline)(l, o), p = o.hooks ? await o.hooks.processAllTokens(c) : c;
        o.walkTokens && await Promise.all(this.walkTokens(p, o.walkTokens));
        let g = await (o.hooks ? await o.hooks.provideParser(e) : e ? O.parse : O.parseInline)(p, o);
        return o.hooks ? await o.hooks.postprocess(g) : g;
      })().catch(s);
      try {
        o.hooks && (n = o.hooks.preprocess(n));
        let u = (o.hooks ? o.hooks.provideLexer(e) : e ? T.lex : T.lexInline)(n, o);
        o.hooks && (u = o.hooks.processAllTokens(u)), o.walkTokens && this.walkTokens(u, o.walkTokens);
        let p = (o.hooks ? o.hooks.provideParser(e) : e ? O.parse : O.parseInline)(u, o);
        return o.hooks && (p = o.hooks.postprocess(p)), p;
      } catch (l) {
        return s(l);
      }
    };
  }
  onError(e, t) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        let i = "<p>An error occurred:</p><pre>" + w(n.message + "", true) + "</pre>";
        return t ? Promise.resolve(i) : i;
      }
      if (t) return Promise.reject(n);
      throw n;
    };
  }
};
var I = new U();
function f(a3, e) {
  return I.parse(a3, e);
}
f.options = f.setOptions = function(a3) {
  return I.setOptions(a3), f.defaults = I.defaults, V(f.defaults), f;
};
f.getDefaults = B;
f.defaults = y;
function At(...a3) {
  return I.use(...a3), f.defaults = I.defaults, V(f.defaults), f;
}
f.use = At;
f.walkTokens = function(a3, e) {
  return I.walkTokens(a3, e);
};
f.parseInline = I.parseInline;
f.Parser = O;
f.parser = O.parse;
f.Renderer = $;
f.TextRenderer = z;
f.Lexer = T;
f.lexer = T.lex;
f.Tokenizer = _;
f.Hooks = L;
f.parse = f;
var Rn = f.options;
var Tn = f.setOptions;
var On = f.walkTokens;
var wn = f.parseInline;
var yn = O.parse;
var Sn = T.lex;

// src/client/markdown.ts
function sanitizeHtml(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<script\b[^>]*\/?>/gi, "").replace(/<(iframe|object|embed|link|meta|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<(iframe|object|embed|link|meta|style)\b[^>]*\/?>/gi, "").replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}
var FRONTMATTER = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
function looksLikeFrontmatter(body) {
  const lines = body.split(/\r?\n/);
  if (lines.some((line) => /^\s*#{1,6}\s/.test(line))) return false;
  return lines.some((line) => /^[A-Za-z_][A-Za-z0-9_-]*\s*:/.test(line));
}
function stripFrontmatter(source) {
  const match = FRONTMATTER.exec(source);
  if (!match || !looksLikeFrontmatter(match[1] ?? "")) return source;
  return source.slice(match[0].length);
}
function renderMarkdown(source) {
  const body = stripFrontmatter(source);
  if (body.trim() === "") return { html: "", empty: true };
  const html = f(body);
  return { html: sanitizeHtml(html), empty: false };
}
var IMG_TAG = /<img\b[^>]*>/gi;
var SRC_ATTR = /(?<![\w-])(src\s*=\s*)(["'])([\s\S]*?)\2/gi;
var SCHEME = /^[a-z][a-z0-9+.-]*:/i;
function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
function resolveFromDoc(docPath, src) {
  const stack = [];
  for (const segment of docPath.replaceAll("\\", "/").split("/").slice(0, -1)) {
    if (segment !== "" && segment !== ".") stack.push(segment);
  }
  for (const segment of src.replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return stack.length === 0 ? null : stack.join("/");
}
function rewrittenValue(value, docPath) {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.includes(RAW_ENDPOINT)) return null;
  if (trimmed.startsWith("/") || SCHEME.test(trimmed)) return null;
  const pathOnly = trimmed.split(/[?#]/)[0] ?? "";
  if (pathOnly === "") return null;
  return resolveFromDoc(docPath, decodePath(pathOnly));
}
function rewriteImageSrc(html, docPath, projectRoot) {
  if (!/<img/i.test(html)) return html;
  return html.replace(IMG_TAG, (tag) => tag.replace(
    SRC_ATTR,
    (match, prefix, quote, value) => {
      const resolved = rewrittenValue(value, docPath);
      return resolved === null ? match : `${prefix}${quote}${rawUrl(projectRoot, resolved)}${quote}`;
    }
  ));
}

// src/spec-status.ts
var SPEC_STATUS_LABELS = {
  draft: "draft",
  planned: "plan.",
  "in-progress": "WIP",
  complete: "done",
  archived: "arch."
};
var STATUS_ALIASES = {
  draft: "draft",
  planned: "planned",
  "in-progress": "in-progress",
  wip: "in-progress",
  complete: "complete",
  done: "complete",
  archived: "archived",
  archive: "archived",
  arch: "archived"
};
var FRONTMATTER_BLOCK = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---/;
var FRONTMATTER_STATUS = /^[ \t]*status[ \t]*:[ \t]*(.+?)[ \t]*$/m;
var BODY_STATUS = /\*\*状态\*\*[ \t]*[:：][ \t]*([^\r\n]+)/;
function normalizeStatus(raw) {
  if (typeof raw !== "string") return void 0;
  let value = raw.trim();
  const quoted = value.length >= 2 && (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'"));
  if (quoted) value = value.slice(1, -1).trim();
  value = value.toLowerCase();
  const whole = STATUS_ALIASES[value.replace(/\s+/g, "-")];
  if (whole !== void 0) return whole;
  const leading = /^[a-z0-9]+(?:[-\s][a-z0-9]+)*/.exec(value);
  if (leading === null) return void 0;
  return STATUS_ALIASES[leading[0].replace(/\s+/g, "-")];
}
function parseSpecStatus(markdown) {
  if (typeof markdown !== "string" || markdown.length === 0) return void 0;
  const block = FRONTMATTER_BLOCK.exec(markdown);
  if (block !== null) {
    const front = FRONTMATTER_STATUS.exec(block[1] ?? "");
    if (front !== null) {
      const fromFrontmatter = normalizeStatus(front[1] ?? "");
      if (fromFrontmatter !== void 0) return fromFrontmatter;
    }
  }
  const body = BODY_STATUS.exec(markdown);
  return body === null ? void 0 : normalizeStatus(body[1] ?? "");
}

// src/client/spec-badge.ts
var SPEC_STATUS_BADGE_CLASS = "dsh-leanspec-spec-status";
function isSpecRootDir(dirPath) {
  return /^\d{3,}-[^/]+$/.test(dirPath);
}
var SPEC_STATUS_PLACEHOLDER_LABEL = "-";
var SPEC_STATUS_PLACEHOLDER_NAME = "none";
function labelFor(status) {
  if (status === void 0) return void 0;
  if (!Object.prototype.hasOwnProperty.call(SPEC_STATUS_LABELS, status)) return void 0;
  const label = SPEC_STATUS_LABELS[status];
  return typeof label === "string" && label.length > 0 ? label : void 0;
}
function specStatusBadge(status) {
  const label = labelFor(status);
  if (label === void 0) {
    return {
      className: `${SPEC_STATUS_BADGE_CLASS} ${SPEC_STATUS_BADGE_CLASS}-${SPEC_STATUS_PLACEHOLDER_NAME}`,
      label: SPEC_STATUS_PLACEHOLDER_LABEL
    };
  }
  return {
    className: `${SPEC_STATUS_BADGE_CLASS} ${SPEC_STATUS_BADGE_CLASS}-${status}`,
    label
  };
}

// src/client/store.ts
var import_react = require("react");

// src/client/surface.ts
var SPLIT_DEFAULT = 280;
var SPLIT_MIN = 180;
var SPLIT_MAX = 420;
var BODY_MIN = 360;
var SPLIT_STEP = 16;
var SPLIT_STORAGE_KEY = "leanspec.split";
function clampSplit(desired, availableWidth) {
  const usable = Number.isFinite(availableWidth) ? availableWidth - BODY_MIN : SPLIT_MAX;
  const upper = Math.min(SPLIT_MAX, usable);
  if (upper <= SPLIT_MIN) return SPLIT_MIN;
  if (Number.isNaN(desired)) return SPLIT_DEFAULT;
  return Math.min(Math.max(Math.round(desired), SPLIT_MIN), upper);
}
function readStoredSplit(raw) {
  if (raw === null || raw === void 0 || raw.trim() === "") return SPLIT_DEFAULT;
  const value = Number(raw);
  if (!Number.isFinite(value)) return SPLIT_DEFAULT;
  const rounded = Math.round(value);
  if (rounded < SPLIT_MIN || rounded > SPLIT_MAX) return SPLIT_DEFAULT;
  return rounded;
}
function splitUpperBound(availableWidth) {
  const usable = Number.isFinite(availableWidth) ? availableWidth - BODY_MIN : SPLIT_MAX;
  return Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, usable));
}
var PANEL_WIDTH = 1040;
var PANEL_HEIGHT = 640;
var PANEL_EDGE = 24;
var ANCHOR_GAP = 8;
var ANCHOR_FALLBACK = 48;
var SURFACE_MIN_WIDTH = PANEL_WIDTH + 2 * PANEL_EDGE;
var SURFACE_MIN_HEIGHT = PANEL_HEIGHT + ANCHOR_FALLBACK + PANEL_EDGE;
function usableAnchor(anchorBottom) {
  return typeof anchorBottom === "number" && Number.isFinite(anchorBottom) && anchorBottom >= 0 ? anchorBottom : ANCHOR_FALLBACK;
}
function usableEdge(edge) {
  return typeof edge === "number" && Number.isFinite(edge) && edge >= 0 ? edge : PANEL_EDGE;
}
function anchorBottomFromTrigger(bottom) {
  return typeof bottom === "number" && Number.isFinite(bottom) && bottom >= 0 ? bottom + ANCHOR_GAP : ANCHOR_FALLBACK;
}
function decideSurface(input) {
  const edge = usableEdge(input.edge);
  const anchor = usableAnchor(input.anchorBottom);
  const roomy = Number.isFinite(input.viewportWidth) && Number.isFinite(input.viewportHeight) && input.viewportWidth >= PANEL_WIDTH + 2 * edge && input.viewportHeight >= PANEL_HEIGHT + anchor + edge;
  return roomy ? "popup" : "tab";
}

// src/client/viewer-state.ts
var NO_LEANSPEC_BANNER = "\u5F53\u524D\u9879\u76EE\u6CA1\u6709 LeanSpec (specs/ \u76EE\u5F55\u4E0D\u5B58\u5728)";
var SPEC_README = /^(\d{3,}-[^/]+)\/readme\.md$/i;
var initialViewerState = {
  loadStatus: "idle",
  present: false,
  specs: [],
  files: [],
  dirs: [],
  expanded: /* @__PURE__ */ new Set(),
  statusByDir: {},
  selected: null,
  mode: "preview",
  content: "",
  draft: "",
  saving: false,
  saveStatus: "idle",
  loadedKey: null,
  split: SPLIT_DEFAULT,
  surface: "popup",
  popupOpen: false,
  pinned: false,
  dragging: false,
  projectRoot: "",
  projectReady: false,
  projects: {}
};
var PROJECT_MEMORY_LIMIT = 8;
var emptyProjectSlice = {
  loadStatus: "idle",
  loadError: void 0,
  present: false,
  specs: [],
  files: [],
  dirs: [],
  expanded: /* @__PURE__ */ new Set(),
  statusByDir: {},
  selected: null,
  mode: "preview",
  content: "",
  draft: "",
  loadedKey: null,
  saving: false,
  saveStatus: "idle",
  saveError: void 0
};
function sliceOfProject(state) {
  return {
    loadStatus: state.loadStatus,
    loadError: state.loadError,
    present: state.present,
    specs: state.specs,
    files: state.files,
    dirs: state.dirs,
    expanded: state.expanded,
    statusByDir: state.statusByDir,
    selected: state.selected,
    mode: state.mode,
    content: state.content,
    draft: state.draft,
    loadedKey: state.loadedKey,
    saving: state.saving,
    saveStatus: state.saveStatus,
    saveError: state.saveError
  };
}
function withProjectSlice(state, slice) {
  return { ...state, ...slice };
}
function switchProject(state, root, ready) {
  if (state.projectRoot === root) {
    return state.projectReady === ready ? state : { ...state, projectReady: ready };
  }
  const projects = state.projectRoot === "" ? state.projects : rememberProject(state.projects, state.projectRoot, sliceOfProject(state), root);
  const restored = root === "" ? void 0 : state.projects[root];
  return {
    ...withProjectSlice(state, restored === void 0 ? emptyProjectSlice : refreshedSlice(restored)),
    projects,
    projectRoot: root,
    projectReady: ready
  };
}
function refreshedSlice(slice) {
  return { ...slice, saving: false, saveStatus: "idle", saveError: void 0 };
}
function rememberProject(projects, root, slice, keep) {
  const next = { ...projects };
  delete next[root];
  next[root] = slice;
  for (const stale of Object.keys(next)) {
    if (Object.keys(next).length <= PROJECT_MEMORY_LIMIT) break;
    if (stale === keep) continue;
    delete next[stale];
  }
  return next;
}
function withSyncedStatus(statusByDir, selected, draft) {
  const match = selected === null ? null : SPEC_README.exec(selected);
  if (match === null) return statusByDir;
  const dir = match[1] ?? "";
  const status = parseSpecStatus(draft);
  const next = { ...statusByDir };
  if (status === void 0) delete next[dir];
  else next[dir] = status;
  return next;
}
function needsFileLoad(state, key, projectReady) {
  if (key === null || !projectReady) return false;
  return state.loadedKey !== key;
}
function reduceViewer(state, action) {
  switch (action.type) {
    case "load-start":
      return { ...state, loadStatus: "loading", loadError: void 0 };
    case "load-success":
      return {
        ...state,
        loadStatus: "ready",
        loadError: void 0,
        present: action.present !== false,
        specs: action.specs ?? [],
        files: action.files,
        dirs: action.dirs ?? [],
        statusByDir: action.statusByDir ?? {}
      };
    case "load-error":
      return {
        ...state,
        loadStatus: action.disconnected === true ? "disconnected" : "error",
        loadError: action.error,
        present: false,
        specs: [],
        files: [],
        dirs: [],
        statusByDir: {},
        saveStatus: "idle",
        saving: false
      };
    case "select":
      return {
        ...state,
        selected: action.path,
        mode: "preview",
        content: "",
        draft: "",
        // A new file has nothing loaded yet, whatever the last one left behind.
        loadedKey: null,
        saveStatus: "idle",
        saveError: void 0
      };
    case "toggle-dir": {
      const expanded = new Set(state.expanded);
      if (expanded.has(action.path)) expanded.delete(action.path);
      else expanded.add(action.path);
      return { ...state, expanded };
    }
    case "file-loaded":
      return {
        ...state,
        content: action.content,
        draft: action.content,
        loadedKey: action.key ?? state.loadedKey,
        saveStatus: "idle",
        saveError: void 0
      };
    case "file-error":
      return {
        ...state,
        loadError: action.error,
        content: "",
        draft: "",
        // A failed read is recorded too: a remount must not silently retry the
        // same path and wipe the sentence that explains it.
        loadedKey: action.key ?? state.loadedKey
      };
    case "set-mode":
      if (action.mode === "edit" && isImagePath(state.selected ?? "")) return state;
      return { ...state, mode: action.mode };
    case "edit":
      return { ...state, draft: action.draft, saveStatus: "idle", saveError: void 0 };
    case "save-start":
      return { ...state, saving: true, saveStatus: "saving", saveError: void 0 };
    case "save-success":
      return {
        ...state,
        saving: false,
        saveStatus: "saved",
        content: state.draft,
        saveError: void 0,
        statusByDir: withSyncedStatus(state.statusByDir, state.selected, state.draft)
      };
    case "save-error":
      return {
        ...state,
        saving: false,
        saveStatus: "error",
        saveError: action.error
      };
    case "set-split":
      return { ...state, split: action.split };
    case "set-surface":
      return {
        ...state,
        surface: action.surface,
        popupOpen: action.surface === "popup" ? state.popupOpen : false,
        // Every surface move is a fresh start: a pin belongs to one panel
        // session only (REQ-1.7, T3.2). The manual path re-pins right after.
        pinned: false
      };
    case "set-popup-open":
      return {
        ...state,
        popupOpen: action.open,
        surface: action.open ? "popup" : state.surface,
        // Opening or closing the popover ends the pinned choice: the next open
        // asks `decideSurface` again (design.md §4.1).
        pinned: false
      };
    case "set-pinned":
      return state.pinned === action.pinned ? state : { ...state, pinned: action.pinned };
    case "set-dragging":
      return state.dragging === action.dragging ? state : { ...state, dragging: action.dragging };
    case "set-project":
      return switchProject(state, action.root, action.ready);
    default:
      return state;
  }
}
function hasTreeData(state) {
  return state.specs.length > 0 || state.files.length > 0 || state.dirs.length > 0;
}
function selectView(state) {
  const refreshing = state.loadStatus === "loading" && hasTreeData(state) && state.present;
  const showTree = (state.loadStatus === "ready" || refreshing) && state.present;
  const banner = state.loadStatus === "error" || state.loadStatus === "disconnected" ? state.loadError : state.loadStatus === "ready" && !state.present ? NO_LEANSPEC_BANNER : void 0;
  const saved = state.saveStatus === "saved" && !state.saving && state.draft === state.content;
  return { showTree, banner, saved, refreshing };
}
function isMarkdownPath(filePath) {
  return filePath.toLowerCase().endsWith(".md");
}

// src/client/store.ts
function createStore(initial) {
  let current = initial;
  const listeners = /* @__PURE__ */ new Set();
  return {
    getState: () => current,
    setState(next) {
      if (Object.is(next, current)) return;
      current = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}
var viewerStore = createStore(initialViewerState);
function useViewerStore() {
  const [state, setState] = (0, import_react.useState)(() => viewerStore.getState());
  (0, import_react.useEffect)(() => {
    return viewerStore.subscribe(() => {
      setState(viewerStore.getState());
    });
  }, []);
  return [
    state,
    (action) => {
      viewerStore.setState(reduceViewer(viewerStore.getState(), action));
    }
  ];
}
function loadPersistedSplit() {
  try {
    return readStoredSplit(window.localStorage.getItem(SPLIT_STORAGE_KEY));
  } catch {
    return readStoredSplit(null);
  }
}
function persistSplit(value) {
  try {
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(value));
  } catch {
  }
}

// src/client/styles.ts
var LEANSPEC_STYLES = `
.dsh-leanspec-root {
  position: relative;
  display: inline-flex;
}
.dsh-leanspec-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 111px;
  height: 32px;
  padding: 6px 12px;
  gap: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 18px;
  color: var(--dsw-alias-label-primary);
  background: transparent;
  font-family: var(--dsw-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  cursor: pointer;
}
.dsh-leanspec-trigger:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-leanspec-trigger.is-open {
  background: var(--dsw-alias-button-ghost-active-fill);
  border-color: var(--dsw-alias-button-ghost-active-border);
}

.dsh-leanspec-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  /* T3.3 / REQ-2.1: 1040x640, capped so it can never leave the viewport. The
     anchor is the popover's own top edge, injected inline by the header; the
     fallback covers the first paint, before anything has been measured. */
  width: min(1040px, calc(100vw - 48px));
  height: min(640px, calc(100vh - var(--anchor, 48px) - 24px));
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 16px 40px var(--dsw-alias-bg-mask-2);
  font-family: var(--dsw-font-family);
}

/* Both exits put a fixed switch strip above one panel, so the panel takes the
   remaining height instead of its own height:100% overflowing the frame. */
.dsh-leanspec-popover > .dsh-leanspec-shell,
.dsh-leanspec-tab > .dsh-leanspec-shell {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
}

/* The tab body: the host pane already draws the tab frame, so this is a bare
   column \u2014 a second border/shadow/radius here would nest inside it. */
.dsh-leanspec-tab {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
  font-size: 13px;
}

/* Notice row only: the switch button moved onto the tree pane's header row
   (2026-10-08), so this bar renders only when there is something to say \u2014 a
   disabled control's reason or a failed switch (REQ-8.2). Never an empty bar.
   The tab body has none either: the tab is one-way, so nothing in the sidebar
   points back at the popup. */
.dsh-leanspec-switchbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}

.dsh-leanspec-switch {
  display: inline-flex;
  align-items: center;
  /* The row's only incompressible item: the pane title gives way (min-width: 0
     + ellipsis), this must never shrink or wrap. Without nowrap a squeezed flex
     item breaks the two-character label onto two lines and the header row grows
     tall (user report, 2026-10-08). */
  flex: 0 0 auto;
  white-space: nowrap;
  height: 26px;
  padding: 0 10px;
  gap: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.dsh-leanspec-switch:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-leanspec-switch:disabled {
  color: var(--dsw-alias-label-tertiary);
  cursor: not-allowed;
}

/* A disabled control's reason, and a failed switch's message: never silent
   (REQ-8.2). */
.dsh-leanspec-notice-text {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dsh-leanspec-shell {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
  font-size: 13px;
}

/* Width is authoritative here (set inline by the shared store); 280px is the
   pre-hydration value. The right edge is drawn by .dsh-leanspec-splitter, so
   there is no border on the aside.
   Measured (tasks.md T1.3): flex 0-0-auto and 0-1-auto behave identically in
   this layout \u2014 the body is flex-basis 0 with min-width 0, so the flex line
   never overflows and nothing gets to shrink. What actually keeps the body at
   360px is the JS clamp in surface.ts, not this line. */
.dsh-leanspec-aside {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  width: 280px;
  background: var(--dsw-specific-sidebar-fill);
}
/* Splitter: a 5px grab area over a 1px rule, invisible at rest but easy to
   catch. touch-action: none stops trackpad and touch drags from scrolling the
   panel instead of moving the divider. */
.dsh-leanspec-splitter {
  flex: 0 0 auto;
  width: 5px;
  margin: 0 -2px;
  position: relative;
  z-index: 1;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
}
.dsh-leanspec-splitter::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 1px;
  background: var(--dsw-alias-border-l2);
}
.dsh-leanspec-splitter:hover::before,
.dsh-leanspec-splitter:focus-visible::before,
.dsh-leanspec-splitter.is-dragging::before {
  background: var(--dsw-static-blue-500);
}
.dsh-leanspec-splitter:focus-visible {
  outline: 2px solid var(--dsw-static-blue-500);
  outline-offset: -2px;
}
.dsh-leanspec-shell.is-dragging {
  cursor: col-resize;
  user-select: none;
}
/* The tree pane's header row: the \u300CLeanSpec\u300D label and the panel's optional
   head control (the popup's \u300C\u5728\u53F3\u680F\u6253\u5F00\u300D) share one line, with the control
   pushed to the right edge of this column (2026-10-08 adjustment).
   min-width: 0 on the label lets it ellipsize instead of shoving the control
   out of a narrow pane \u2014 the splitter bottoms out at 180px. */
.dsh-leanspec-aside-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  gap: 8px;
  padding: 8px 14px 6px;
}
.dsh-leanspec-aside-title {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-leanspec-banner {
  margin: 0 14px 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-state-warn-tertiary);
  color: var(--dsw-alias-state-warn-label);
  line-height: 1.45;
}
.dsh-leanspec-tree {
  flex: 1;
  overflow: auto;
  /* 6px + the row's own 8px of padding puts the first column at x=14, which is
     exactly where .dsh-leanspec-aside-title and .dsh-leanspec-banner start, so
     the whole panel shares one left edge. */
  padding: 4px 6px 12px;
}
.dsh-leanspec-tree ul {
  list-style: none;
  margin: 0;
  padding: 0 0 0 12px;
}
.dsh-leanspec-tree li {
  /* Stated explicitly: a host rule on li (padding or a marker) would shift
     whole rows and make the badge column look ragged. */
  margin: 0;
  padding: 0;
  list-style: none;
}
.dsh-leanspec-tree > ul {
  padding-left: 0;
}
.dsh-leanspec-dir,
.dsh-leanspec-file {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 6px;
  margin: 1px 0;
  padding: 5px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dsh-leanspec-dir {
  color: var(--dsw-alias-label-secondary);
  font-weight: 500;
}
.dsh-leanspec-dir:hover,
.dsh-leanspec-file:hover {
  background: var(--dsw-specific-sidebar-nav-item-hover);
}
.dsh-leanspec-file.is-selected {
  background: var(--dsw-specific-sidebar-nav-item-active);
  color: var(--dsw-alias-label-primary);
}
/* Specificity hardening. Every rule above is a single class (0,1,0), while the
   Host sidebar ships rules like .dsh-sidebar button (0,1,1) that would win and
   replace our row with an inline-flex box. That silently drops gap/flex, so each
   row lays its badge out after the glyph \u2014 and because a collapsed arrow and an
   expanded one have different advance widths, the badge column staggers per row.
   Only the row (a button) and the arrow need this: the badge is a span, so a
   host button rule cannot reach it, and its pinned single-class rule stays the
   only match the styles tests find for it. */
.dsh-leanspec-shell .dsh-leanspec-dir,
.dsh-leanspec-shell .dsh-leanspec-file {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  padding: 5px 8px;
}
.dsh-leanspec-shell .dsh-leanspec-dir > .dsh-leanspec-chevron {
  /* display is repeated on purpose: if a host rule such as button > span turns
     the arrow back into an inline box, width and flex are ignored. The glyph is
     a fixed-px pseudo-element (see below), so the ink box stays 6x6 either way
     and no longer depends on a font's advance width. */
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  flex: 0 0 14px;
  min-width: 14px;
  width: 14px;
}
/* The expand/collapse glyph.
   One pseudo-element, drawn once and only rotated between the two states, so the
   ink box is identical by construction. The previous Unicode triangles (U+25B8
   /U+25BE, then U+25B6 / U+25BC) each carried a different advance width, so the
   14px column could not make the two states agree: the collapsed and expanded
   arrows measured differently and the badge column staggered per row. Borders in
   fixed px remove the font from the equation entirely.
   Geometry: border-left 6px + transparent top/bottom 3px = a 6x6 right-pointing
   triangle; rotating it 90deg about its centre yields a 6x6 down-pointing one.
   Transforms do not affect layout, so both states occupy the same 6px. */
.dsh-leanspec-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  /* flex 0 0 14px, not just width: as a flex item the arrow would otherwise be
     shrinkable, and a per-row shrink would stagger every badge behind it. */
  flex: 0 0 14px;
  width: 14px;
  color: var(--dsw-alias-label-caption);
}
.dsh-leanspec-chevron::before {
  content: '';
  border-left: 6px solid currentColor;
  border-top: 3px solid transparent;
  border-bottom: 3px solid transparent;
  /* Collapsed: pointing right. */
  transform: rotate(0deg);
}
/* Open: the same triangle, rotated in place \u2014 never a second glyph. */
.dsh-leanspec-chevron.is-open::before {
  transform: rotate(90deg);
}
/* Spec status badge. Never squeezed (flex: 0 0 auto) \u2014 the file name carries
   the ellipsis instead. Text stays a fixed dark tone rather than label-primary,
   which flips light in dark mode and would fall under 4.5:1 on these fills.
   Fills come from static tokens so the greyscale spacing is deterministic;
   draft is a 44/56 blue-400 x green-400 mix, the closest reachable teal.
   All six badges are pinned to 42px so the spec names line up in a column.
   Measured in Segoe UI 11px/500 (the host stack on Windows): the widest label is
   "done" at 25.47px, not "draft"; the worst common fallback is Verdana at
   27.05px, so 30px of content room keeps about 3px of slack. border-box is
   declared explicitly because a host-wide border-box would otherwise move
   min-width onto the border box, leaving 18px of room and letting "done" grow
   past its siblings. min-width (not width) means a wider font cannot clip. */
.dsh-leanspec-spec-status {
  flex: 0 0 auto;
  box-sizing: border-box;
  min-width: 42px;
  text-align: center;
  padding: 1px 6px;
  border-radius: 6px;
  color: var(--dsw-static-neutral-bluish-1000);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}
.dsh-leanspec-spec-status-draft {
  background: color-mix(in srgb, var(--dsw-static-blue-400) 44%, var(--dsw-static-green-400) 56%);
}
.dsh-leanspec-spec-status-planned {
  /* deepseek-500 alone lands on 4.46:1 \u2014 under AA \u2014 so it is mixed toward
     blue-500: 4.73:1, and planned sits 18.6 grey steps below done instead of
     14.5. A single blue token could not hold both constraints. */
  background: color-mix(in srgb, var(--dsw-static-deepseek-500) 60%, var(--dsw-static-blue-500) 40%);
}
.dsh-leanspec-spec-status-in-progress {
  background: var(--dsw-static-amber-400);
}
.dsh-leanspec-spec-status-complete {
  background: var(--dsw-static-green-500);
}
.dsh-leanspec-spec-status-archived {
  background: var(--dsw-static-neutral-bluish-300);
}
/* No usable status. Deliberately NO fill: it sits directly on the panel surface,
   so its text must come from a theme-aware alias token (tertiary = bluish-600 in
   light, bluish-400 in dark) rather than the fixed dark tone used on the fills.
   Contrast is 3.71:1 light / 8.54:1 dark (measured, pinned by styles.test.ts) \u2014
   the text is below AA in light mode on purpose (a dash marks an absence), but
   the outline is a UI boundary and clears WCAG 1.4.11's 3:1, which is what makes
   the chip's shape readable at all. Padding drops to 0 5px so the 1px border
   keeps the same 1px/6px inner inset as the filled badges and the row height
   cannot change. */
.dsh-leanspec-spec-status-none {
  color: var(--dsw-alias-label-tertiary);
  padding: 0 5px;
  border: 1px solid currentColor;
}
.dsh-leanspec-file-name {
  /* flex 1 1 0 + min-width 0 so a long name absorbs every pixel of shrink and
     ellipsises. Without it the name refuses its share, flex distributes the
     deficit onto the arrow, and the badge behind a shrunk arrow drifts left \u2014
     which is what made long spec names look misaligned. */
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsh-leanspec-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-leanspec-chrome {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-leanspec-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 6px;
}
.dsh-leanspec-path {
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 0 12px 8px;
  color: var(--dsw-alias-label-caption);
  font-size: 12px;
  line-height: 1.45;
  text-align: left;
  overflow-wrap: anywhere;
  word-break: break-all;
}
.dsh-leanspec-chip {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  cursor: pointer;
}
.dsh-leanspec-chip:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-leanspec-chip.is-active {
  background: var(--dsw-alias-button-ghost-active-fill);
  border-color: var(--dsw-alias-button-ghost-active-border);
  color: var(--dsw-alias-label-primary);
}
.dsh-leanspec-chip:disabled {
  opacity: 0.45;
  color: var(--dsw-alias-label-primary);
  cursor: default;
}
.dsh-leanspec-save {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: var(--dsw-alias-state-business-primary);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  cursor: pointer;
}
.dsh-leanspec-save:hover:not(:disabled) {
  background: var(--dsw-alias-button-info-hover);
}
.dsh-leanspec-save:disabled {
  opacity: 0.45;
  color: var(--dsw-alias-label-primary);
  cursor: default;
}
.dsh-leanspec-status-ok {
  color: var(--dsw-alias-state-success-primary);
  font-size: 12px;
}
.dsh-leanspec-status-err {
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
}

.dsh-leanspec-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px 24px 28px;
  color: var(--dsw-alias-label-primary);
}
.dsh-leanspec-empty {
  margin: 24px 0 0;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-leanspec-preview h1,
.dsh-leanspec-preview h2,
.dsh-leanspec-preview h3,
.dsh-leanspec-preview h4 {
  margin: 0 0 12px;
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
.dsh-leanspec-preview p,
.dsh-leanspec-preview li {
  margin: 0 0 8px;
  line-height: 1.65;
  color: var(--dsw-alias-label-secondary);
}
.dsh-leanspec-preview ul,
.dsh-leanspec-preview ol {
  margin: 0 0 12px;
  padding-left: 20px;
}
/* Tables copy the Host's own markdown-table look rather than inventing one: the
   Host draws row rules only \u2014 th a .5px border-l3, td a .5px border-l2 \u2014 with
   edge-trimmed padding so the first column lines up with the prose beside it.
   No vertical lines, on purpose. Typography and colours come from its tokens
   (--dsw-font-markdown-table / -table-head), so a Host restyle carries over.
   marked emits a bare table with no wrapper, so the Host's scroll container is
   replaced by making the table itself scroll. text-align is set ONLY on cells
   without an align attribute: marked writes align="center|left|right" for :---:
   columns, and a plain text-align would beat that presentational hint. */
.dsh-leanspec-preview table {
  display: block;
  max-width: 100%;
  margin: 0 0 12px;
  overflow-x: auto;
  border-collapse: collapse;
}
.dsh-leanspec-preview th,
.dsh-leanspec-preview td {
  padding: 10px 16px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  vertical-align: top;
  max-width: min(30vw, 320px);
  min-width: 100px;
}
.dsh-leanspec-preview th {
  border-bottom-color: var(--dsw-alias-border-l3);
  font: var(--dsw-font-markdown-table-head);
}
.dsh-leanspec-preview td {
  font: var(--dsw-font-markdown-table);
}
.dsh-leanspec-preview th:first-child,
.dsh-leanspec-preview td:first-child {
  padding-left: 0;
}
.dsh-leanspec-preview td:last-child {
  padding-right: 0;
}
.dsh-leanspec-preview table code {
  font-size: 11px;
}
.dsh-leanspec-preview th:not([align]) {
  text-align: left;
}
.dsh-leanspec-preview code,
.dsh-leanspec-source {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: var(--dsw-alias-markdown-code-block);
  color: var(--dsw-alias-label-primary);
}
.dsh-leanspec-source {
  margin: 0;
  padding: 14px 16px;
  border-radius: 10px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
  font-size: 12.5px;
}
/* Gaps filled in from Host tokens, each because the browser default is wrong for
   a document panel: a long code line would overflow, an oversized image would
   stretch the panel, a link would fall back to the browser blue, and a --- ruler
   would sit in the browser's cramped 0.5em gap instead of the Host's 32px. */
.dsh-leanspec-preview pre {
  margin: 0 0 12px;
  padding: 12px 14px;
  border-radius: 10px;
  overflow-x: auto;
  background: var(--dsw-alias-markdown-code-block);
}
.dsh-leanspec-preview hr {
  display: block;
  height: 0.5px;
  margin: 32px 0;
  border: none;
  background: var(--dsw-alias-border-l2);
}
.dsh-leanspec-preview a {
  color: var(--dsw-alias-link);
}
.dsh-leanspec-preview img {
  max-width: 100%;
}
.dsh-leanspec-editor {
  width: 100%;
  height: 100%;
  min-height: 280px;
  box-sizing: border-box;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-markdown-code-block);
  color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  resize: none;
  outline: none;
}
.dsh-leanspec-editor:focus {
  border-color: var(--dsw-alias-state-business-primary);
}
/* Image preview (008). The wrap fills the body's content box so
   max-height: 100% on the image has something definite to resolve against;
   height: 100% degrades to auto outside a sized ancestor, so an unknown panel
   height falls back to "as tall as the picture" plus the body's own scroll. */
.dsh-leanspec-image-wrap {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 240px;
  overflow: auto;
}
/* The click target that opens the raw bytes in a new tab. It carries the height
   so the image inside it can be capped: a percentage max-height against an
   auto-height parent is ignored, which would let a large file stretch the wrap. */
.dsh-leanspec-image-link {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  max-width: 100%;
}
.dsh-leanspec-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: zoom-in;
}
/* Failure state. Same warning pair as the load banner: a message plus the one
   action that can help, never an empty box or a broken-image glyph. */
.dsh-leanspec-image-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin: 24px 0 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--dsw-alias-state-warn-tertiary);
  color: var(--dsw-alias-state-warn-label);
  line-height: 1.45;
}
`;
var inserted = false;
function ensureLeanspecStyles() {
  if (inserted || typeof document === "undefined") return;
  if (document.getElementById("dsh-leanspec-styles")) {
    inserted = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "dsh-leanspec-styles";
  style.textContent = LEANSPEC_STYLES;
  document.head.appendChild(style);
  inserted = true;
}

// src/client/LeanspecViewer.ts
async function readError(response) {
  try {
    const payload = await response.json();
    if (payload.error) return payload.error;
  } catch {
  }
  return response.statusText || `HTTP ${response.status}`;
}
function withRoot(url, projectRoot) {
  if (!projectRoot) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${new URLSearchParams({ root: projectRoot }).toString()}`;
}
function escapeText(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
var VIEW_MODE_LABELS = {
  preview: "\u9884\u89C8",
  source: "\u6E90\u7801",
  edit: "\u7F16\u8F91"
};
function TreeNodes(props) {
  return (0, import_react2.createElement)(
    "ul",
    null,
    ...props.nodes.map((node) => {
      if (node.kind === "dir") {
        const open = props.expanded.has(node.path);
        const badge = isSpecRootDir(node.path) ? specStatusBadge(props.statusByDir[node.path]) : null;
        return (0, import_react2.createElement)(
          "li",
          { key: node.path },
          (0, import_react2.createElement)(
            "button",
            {
              type: "button",
              className: "dsh-leanspec-dir",
              onClick: () => props.onToggle(node.path)
            },
            (0, import_react2.createElement)("span", { className: `dsh-leanspec-chevron${open ? " is-open" : ""}` }),
            // A span, never a button: the row is already a button, and clicking
            // the row is what selects the spec.
            badge === null ? null : (0, import_react2.createElement)("span", { className: badge.className }, badge.label),
            (0, import_react2.createElement)("span", { className: "dsh-leanspec-file-name" }, node.name)
          ),
          open && node.children ? (0, import_react2.createElement)(TreeNodes, {
            nodes: node.children,
            selected: props.selected,
            expanded: props.expanded,
            statusByDir: props.statusByDir,
            onToggle: props.onToggle,
            onSelect: props.onSelect
          }) : null
        );
      }
      return (0, import_react2.createElement)(
        "li",
        { key: node.path },
        (0, import_react2.createElement)(
          "button",
          {
            type: "button",
            className: `dsh-leanspec-file${props.selected === node.path ? " is-selected" : ""}`,
            onClick: () => props.onSelect(node.path)
          },
          (0, import_react2.createElement)("span", { className: "dsh-leanspec-file-name" }, node.name)
        )
      );
    })
  );
}
function PanelSplitter(props) {
  return (0, import_react2.createElement)("div", {
    className: `dsh-leanspec-splitter${props.dragging ? " is-dragging" : ""}`,
    role: "separator",
    "aria-orientation": "vertical",
    "aria-label": "\u8C03\u6574\u76EE\u5F55\u5BBD\u5EA6",
    "aria-valuemin": SPLIT_MIN,
    "aria-valuemax": props.max,
    "aria-valuenow": props.value,
    "data-leanspec-splitter": "true",
    tabIndex: 0,
    onPointerDown: props.onPointerDown,
    onPointerMove: props.onPointerMove,
    onPointerUp: props.onPointerUp,
    onPointerCancel: props.onPointerUp,
    onDoubleClick: props.onReset,
    onKeyDown: props.onKeyDown
  });
}
function ImageView(props) {
  if (props.error !== null) {
    return (0, import_react2.createElement)(
      "div",
      { role: "alert", className: "dsh-leanspec-image-error" },
      (0, import_react2.createElement)("span", null, props.error),
      (0, import_react2.createElement)("button", {
        type: "button",
        className: "dsh-leanspec-chip",
        "data-leanspec-image-retry": "true",
        onClick: props.onRetry
      }, "\u91CD\u8BD5")
    );
  }
  return (0, import_react2.createElement)(
    "div",
    { className: "dsh-leanspec-image-wrap" },
    // An anchor, not a script handler: the raw bytes open in a new tab on click,
    // and middle-click / "open in new tab" keep working.
    (0, import_react2.createElement)(
      "a",
      {
        className: "dsh-leanspec-image-link",
        href: props.src,
        target: "_blank",
        rel: "noreferrer"
      },
      (0, import_react2.createElement)("img", {
        key: `${props.src}#${props.nonce}`,
        className: "dsh-leanspec-image",
        src: props.src,
        alt: props.alt,
        onError: () => {
          props.onError();
        }
      })
    )
  );
}
function ViewerMain(props) {
  const { selected, mode } = props;
  const imageSelected = selected !== null && isImagePath(selected);
  const markdown = selected !== null && isMarkdownPath(selected);
  const preview = markdown ? renderMarkdown(props.content) : null;
  const previewHtml = selected !== null && preview !== null && !preview.empty ? rewriteImageSrc(preview.html, selected, props.projectRoot ?? "") : "";
  const editable = canEditFile(selected);
  const dirty = props.draft !== props.content;
  return (0, import_react2.createElement)(
    "section",
    { className: "dsh-leanspec-main" },
    (0, import_react2.createElement)(
      "header",
      { className: "dsh-leanspec-chrome" },
      (0, import_react2.createElement)(
        "div",
        { className: "dsh-leanspec-toolbar" },
        ...viewModesFor(selected).map((option) => (0, import_react2.createElement)("button", {
          key: option,
          type: "button",
          className: `dsh-leanspec-chip${mode === option ? " is-active" : ""}`,
          "data-leanspec-view-mode": option,
          onClick: () => props.onMode(option),
          // Only `edit` is ever disabled, and for an image it stays visible but
          // greyed out (REQ-5). Preview and source always work.
          disabled: option === "edit" && (selected === null || !editable)
        }, VIEW_MODE_LABELS[option])),
        (0, import_react2.createElement)("button", {
          type: "button",
          className: "dsh-leanspec-save",
          onClick: props.onSave,
          // Images are never savable: their text form is mojibake, and writing it
          // back would destroy the file (REQ-5).
          disabled: selected === null || !editable || !dirty || props.saving
        }, props.saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58"),
        props.saved ? (0, import_react2.createElement)("span", { className: "dsh-leanspec-status-ok" }, "\u5DF2\u4FDD\u5B58") : null,
        props.saveError ? (0, import_react2.createElement)("span", { role: "alert", className: "dsh-leanspec-status-err" }, props.saveError) : null
      ),
      selected !== null ? (0, import_react2.createElement)("div", { className: "dsh-leanspec-path" }, selected) : null
    ),
    (0, import_react2.createElement)(
      "div",
      { className: "dsh-leanspec-body" },
      selected === null && props.showTree ? (0, import_react2.createElement)("p", { className: "dsh-leanspec-empty" }, "\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6\u3002") : null,
      // Preview of an image file: <img> only, never the utf8 text (N-4).
      selected !== null && imageSelected && mode === "preview" ? (0, import_react2.createElement)(ImageView, {
        src: rawUrl(props.projectRoot ?? "", selected),
        alt: selected,
        error: props.imageError,
        nonce: props.imageNonce,
        onError: props.onImageError,
        onRetry: props.onImageRetry
      }) : null,
      selected !== null && mode === "preview" && markdown && preview?.empty ? (0, import_react2.createElement)("p", { className: "dsh-leanspec-empty" }, "\u7A7A\u6587\u4EF6") : null,
      selected !== null && mode === "preview" && markdown && preview !== null && !preview.empty ? (0, import_react2.createElement)("div", {
        className: "dsh-leanspec-preview",
        dangerouslySetInnerHTML: { __html: previewHtml }
      }) : null,
      // Read-only source: an SVG's XML (REQ-6), or any other text file in preview.
      selected !== null && (mode === "source" || mode === "preview" && !markdown && !imageSelected) ? (0, import_react2.createElement)("pre", {
        className: "dsh-leanspec-source",
        dangerouslySetInnerHTML: { __html: escapeText(props.content) }
      }) : null,
      selected !== null && mode === "edit" ? (0, import_react2.createElement)("textarea", {
        className: "dsh-leanspec-editor",
        value: props.draft,
        onChange: (event) => props.onDraft(event.target.value)
      }) : null
    )
  );
}
function LeanspecViewer({ projectRoot: rootProp, projectReady: readyProp, headAction }) {
  const [state, dispatch] = useViewerStore();
  const projectRoot = rootProp ?? state.projectRoot;
  const projectReady = readyProp ?? state.projectReady;
  const dragging = state.dragging;
  const [imageFailure, setImageFailure] = (0, import_react2.useState)(null);
  const [imageNonce, setImageNonce] = (0, import_react2.useState)(0);
  const [panelWidth, setPanelWidth] = (0, import_react2.useState)(0);
  const panelWidthRef = (0, import_react2.useRef)(0);
  const shellRef = (0, import_react2.useRef)(null);
  const dragRef = (0, import_react2.useRef)(null);
  const view = selectView(state);
  const tree = buildFileTree(state.files, state.dirs);
  const imageError = imageFailure !== null && imageFailure.path === state.selected ? imageFailure.text : null;
  const textKey = state.selected === null || !shouldLoadText(state.selected, state.mode) ? null : isImagePath(state.selected) ? `${state.selected}\0${state.mode}` : state.selected;
  (0, import_react2.useEffect)(() => {
    ensureLeanspecStyles();
  }, []);
  (0, import_react2.useEffect)(() => {
    const shell = shellRef.current;
    if (shell === null) return;
    const measure = () => {
      const width = shell.getBoundingClientRect().width;
      panelWidthRef.current = width;
      setPanelWidth(width);
      const current = viewerStore.getState().split;
      const clamped = clampSplit(current, width);
      if (clamped !== current) dispatch({ type: "set-split", split: clamped });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(shell);
    return () => {
      observer.disconnect();
    };
  }, []);
  (0, import_react2.useEffect)(() => {
    const stored = loadPersistedSplit();
    if (stored !== SPLIT_DEFAULT) dispatch({ type: "set-split", split: stored });
  }, []);
  (0, import_react2.useEffect)(() => {
    if (!projectReady) {
      dispatch({ type: "load-start" });
      return;
    }
    let cancelled = false;
    dispatch({ type: "load-start" });
    fetch(withRoot("/leanspec-viewer/tree", projectRoot)).then(async (response) => {
      if (!response.ok) throw new Error(await readError(response));
      return await response.json();
    }).then((payload) => {
      if (!cancelled) {
        dispatch({
          type: "load-success",
          specs: payload.specs,
          files: payload.files,
          dirs: payload.dirs,
          present: payload.present,
          statusByDir: payload.statusByDir
        });
      }
    }).catch((error) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : "failed to load files";
      dispatch({ type: "load-error", error: message, disconnected: error instanceof TypeError });
    });
    return () => {
      cancelled = true;
    };
  }, [projectReady, projectRoot]);
  (0, import_react2.useEffect)(() => {
    if (textKey === null || !projectReady) return;
    if (!needsFileLoad(viewerStore.getState(), textKey, projectReady)) return;
    const requestedPath = textKey.split("\0")[0] ?? "";
    let cancelled = false;
    const params = new URLSearchParams({ path: requestedPath });
    if (projectRoot) params.set("root", projectRoot);
    fetch(`/leanspec-viewer/file?${params.toString()}`).then(async (response) => {
      if (!response.ok) throw new Error(await readError(response));
      return await response.json();
    }).then((payload) => {
      if (!cancelled) dispatch({ type: "file-loaded", content: payload.content, key: textKey });
    }).catch((error) => {
      if (!cancelled) {
        dispatch({
          type: "file-error",
          error: error instanceof Error ? error.message : "failed to load file",
          key: textKey
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectReady, projectRoot, textKey]);
  async function readFailureCode(response) {
    try {
      const payload = await response.json();
      return typeof payload.code === "string" ? payload.code : void 0;
    } catch {
      return void 0;
    }
  }
  async function reportImageFailure() {
    const path = state.selected;
    if (path === null) return;
    let status = 0;
    let detail;
    try {
      const response = await fetch(rawUrl(projectRoot ?? "", path));
      status = response.status;
      if (response.ok) await response.body?.cancel();
      else detail = await readFailureCode(response);
    } catch {
      status = 0;
    }
    setImageFailure({ path, text: imageLoadErrorText(status, detail) });
  }
  async function save() {
    if (!state.selected || state.saving || !canEditFile(state.selected)) return;
    dispatch({ type: "save-start" });
    try {
      const response = await fetch("/leanspec-viewer/file", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          root: projectRoot,
          path: state.selected,
          content: state.draft
        })
      });
      if (!response.ok) throw new Error(await readError(response));
      dispatch({ type: "save-success" });
    } catch (error) {
      dispatch({
        type: "save-error",
        error: error instanceof Error ? error.message : "save failed"
      });
    }
  }
  function toggleDir(dirPath) {
    dispatch({ type: "toggle-dir", path: dirPath });
  }
  function availableWidth() {
    return panelWidthRef.current > 0 ? panelWidthRef.current : Number.POSITIVE_INFINITY;
  }
  function applySplit(desired) {
    const next = clampSplit(desired, availableWidth());
    dispatch({ type: "set-split", split: next });
    return next;
  }
  function endDrag() {
    if (dragRef.current === null) return;
    dragRef.current = null;
    dispatch({ type: "set-dragging", dragging: false });
    persistSplit(viewerStore.getState().split);
  }
  function onSplitterPointerDown(event) {
    dragRef.current = { startX: event.clientX, startWidth: state.split };
    event.currentTarget.setPointerCapture(event.pointerId);
    dispatch({ type: "set-dragging", dragging: true });
  }
  function onSplitterPointerMove(event) {
    const drag = dragRef.current;
    if (drag === null) return;
    applySplit(drag.startWidth + (event.clientX - drag.startX));
  }
  function onSplitterKeyDown(event) {
    const step = event.key === "ArrowLeft" ? -SPLIT_STEP : event.key === "ArrowRight" ? SPLIT_STEP : 0;
    if (step === 0) return;
    event.preventDefault();
    persistSplit(applySplit(state.split + step));
  }
  return (0, import_react2.createElement)(
    "div",
    { ref: shellRef, className: `dsh-leanspec-shell${dragging ? " is-dragging" : ""}` },
    (0, import_react2.createElement)(
      "aside",
      { className: "dsh-leanspec-aside", style: { width: `${state.split}px` } },
      (0, import_react2.createElement)(
        "div",
        { className: "dsh-leanspec-aside-head" },
        (0, import_react2.createElement)("div", { className: "dsh-leanspec-aside-title" }, "LeanSpec"),
        // Right-aligned in this column: the tree pane is where the room is and
        // the control switches *this* panel's exit.
        headAction ?? null
      ),
      view.banner ? (0, import_react2.createElement)("p", { role: "alert", className: "dsh-leanspec-banner" }, view.banner) : null,
      view.showTree ? (0, import_react2.createElement)(
        "nav",
        {
          className: "dsh-leanspec-tree",
          // A background refresh (T4.x): the tree on screen is the previous
          // snapshot until the new one lands, so mark it busy instead of
          // blanking it out — the only visible trace of the reload.
          "aria-busy": view.refreshing ? true : void 0
        },
        (0, import_react2.createElement)(TreeNodes, {
          nodes: tree,
          selected: state.selected,
          expanded: state.expanded,
          statusByDir: state.statusByDir,
          onToggle: toggleDir,
          onSelect: (path) => dispatch({ type: "select", path })
        })
      ) : null
    ),
    (0, import_react2.createElement)(PanelSplitter, {
      value: state.split,
      max: panelWidth > 0 ? splitUpperBound(panelWidth) : SPLIT_MAX,
      dragging,
      onPointerDown: onSplitterPointerDown,
      onPointerMove: onSplitterPointerMove,
      onPointerUp: endDrag,
      onKeyDown: onSplitterKeyDown,
      onReset: () => {
        persistSplit(applySplit(SPLIT_DEFAULT));
      }
    }),
    (0, import_react2.createElement)(ViewerMain, {
      selected: state.selected,
      mode: state.mode,
      projectRoot,
      content: state.content,
      draft: state.draft,
      saving: state.saving,
      saved: view.saved,
      saveError: state.saveError,
      showTree: view.showTree,
      imageError,
      imageNonce,
      onMode: (mode) => dispatch({ type: "set-mode", mode }),
      onDraft: (draft) => dispatch({ type: "edit", draft }),
      onSave: () => {
        void save();
      },
      onImageError: () => {
        void reportImageFailure();
      },
      onImageRetry: () => {
        setImageFailure(null);
        setImageNonce((current) => current + 1);
      }
    })
  );
}

// src/client/project-root.ts
function projectRootFromSlot(input) {
  const sessionId = input.sessionId == null ? "" : String(input.sessionId);
  const fromWorkspace = input.workspaces?.find(
    (workspace) => Array.isArray(workspace.sessionIds) && workspace.sessionIds.some((id) => String(id) === sessionId)
  )?.path;
  if (typeof fromWorkspace === "string" && fromWorkspace.trim() !== "") return fromWorkspace.trim();
  if (typeof input.sessionCwd === "string" && input.sessionCwd.trim() !== "") return input.sessionCwd.trim();
  return void 0;
}
function fallbackWorkspaces(selector) {
  return selector({ items: [], baselinesReady: true });
}
function fallbackSessions(selector) {
  return selector({ byId: {} });
}

// src/client/surface-follow.ts
var FOLLOW_THROTTLE_MS = 150;
var SURFACE_DEFERRED_MOUNTED = "\u53F3\u680F\u6807\u7B7E\u8FD8\u6CA1\u5C31\u7EEA\uFF0C\u7A0D\u540E\u4F1A\u81EA\u52A8\u5207\u8FC7\u53BB";
function planFollow(snapshot, input) {
  if (!snapshot.panelVisible) return { kind: "idle", reason: "no-panel" };
  const wanted = decideSurface(input.measured);
  const decided = wanted === "tab" && !snapshot.tabAvailable ? "popup" : wanted;
  if (decided === snapshot.surface) return { kind: "idle", reason: "in-sync" };
  if (snapshot.pinned) return { kind: "idle", reason: "pinned" };
  if (snapshot.dragging) return { kind: "idle", reason: "dragging" };
  if (decided === "popup" && snapshot.tabOpen) return { kind: "idle", reason: "tab-wins" };
  if (decided === "tab" && !input.mounted) {
    return { kind: "deferred", reason: "sidebar-not-mounted", decided };
  }
  return { kind: "switch", decided };
}
function defaultSubscribe(handler) {
  if (typeof window === "undefined") return () => void 0;
  window.addEventListener("resize", handler);
  return () => {
    window.removeEventListener("resize", handler);
  };
}
function createSurfaceFollower(deps) {
  const subscribe = deps.subscribe ?? defaultSubscribe;
  const setTimer = deps.setTimer ?? ((handler, ms) => setTimeout(handler, ms));
  const clearTimer = deps.clearTimer ?? ((handle) => {
    clearTimeout(handle);
  });
  const throttleMs = deps.throttleMs ?? FOLLOW_THROTTLE_MS;
  let timer = null;
  let pending = false;
  let disposed = false;
  let announced = null;
  function evaluate() {
    const outcome = planFollow(deps.read(), { measured: deps.measure(), mounted: deps.mounted() });
    if (outcome.kind === "switch") {
      announced = null;
      deps.apply(outcome.decided);
      return outcome;
    }
    if (outcome.kind === "deferred") {
      if (announced !== outcome.reason) {
        announced = outcome.reason;
        deps.notify(SURFACE_DEFERRED_MOUNTED);
      }
      return outcome;
    }
    announced = null;
    return outcome;
  }
  function tick() {
    if (disposed) return;
    deps.onTick?.();
    evaluate();
  }
  function onEvent() {
    if (disposed) return;
    if (timer === null) {
      tick();
      timer = setTimer(() => {
        timer = null;
        if (pending) {
          pending = false;
          onEvent();
        }
      }, throttleMs);
      return;
    }
    pending = true;
  }
  const unsubscribe = subscribe(onEvent);
  return {
    evaluate,
    schedule: onEvent,
    dispose() {
      disposed = true;
      unsubscribe();
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
      pending = false;
    }
  };
}

// src/client/LeanspecSidebarTab.ts
var import_react3 = require("react");

// src/client/tab-surface.ts
var LEANSPEC_TAB_ID = "dsh-leanspec";
var LEANSPEC_TAB_KIND = "leanspec";
var LEANSPEC_TAB_TITLE = "LeanSpec";
var TAB_UNAVAILABLE_HOST = "\u5F53\u524D\u5BBF\u4E3B\u7248\u672C\u4E0D\u652F\u6301\u53F3\u680F\u6807\u7B7E";
var TAB_UNAVAILABLE_REGISTRATION = "\u53F3\u680F\u6807\u7B7E\u672A\u80FD\u6CE8\u518C";
function leanspecTabDefinition() {
  return {
    id: LEANSPEC_TAB_ID,
    kind: LEANSPEC_TAB_KIND,
    title: () => LEANSPEC_TAB_TITLE
  };
}
var NO_TAB_CAPABILITY = {
  canOpen: false,
  registered: false,
  available: false,
  unavailableReason: TAB_UNAVAILABLE_HOST
};
function tabAvailability(input) {
  if (input.canOpen && input.registered) return { available: true, unavailableReason: void 0 };
  return {
    available: false,
    unavailableReason: input.canOpen ? TAB_UNAVAILABLE_REGISTRATION : TAB_UNAVAILABLE_HOST
  };
}
function read(host2, key) {
  try {
    if (host2 === null || typeof host2 !== "object") return void 0;
    return host2[key];
  } catch {
    return void 0;
  }
}
function isCallable(value) {
  try {
    return typeof value === "function";
  } catch {
    return false;
  }
}
function readService(host2, key) {
  const get = read(host2, "get");
  if (isCallable(get)) {
    try {
      const viaGet = get.call(host2, key);
      if (viaGet !== void 0) return viaGet;
    } catch {
    }
  }
  return read(host2, key);
}
function detectTabCapability(ctx) {
  try {
    const registry = readService(ctx, "sidebarRightTabs");
    const sidebar = readService(ctx, "sidebarRight");
    const canOpen = isCallable(read(registry, "register")) && isCallable(read(sidebar, "openTab"));
    return {
      canOpen,
      registered: false,
      ...tabAvailability({ canOpen, registered: false })
    };
  } catch {
    return NO_TAB_CAPABILITY;
  }
}
function createTabController(detect) {
  let capability = detect();
  let open = false;
  const listeners = /* @__PURE__ */ new Set();
  function notify() {
    for (const listener of [...listeners]) listener();
  }
  function set(next) {
    const changed = next.canOpen !== capability.canOpen || next.registered !== capability.registered || next.available !== capability.available || next.unavailableReason !== capability.unavailableReason;
    capability = next;
    if (changed) notify();
  }
  return {
    capability: () => capability,
    isOpen: () => open,
    markOpen(next) {
      if (next === open) return;
      open = next;
      notify();
    },
    noteRegistration(collectedDisposer) {
      const availability = tabAvailability({
        canOpen: capability.canOpen,
        registered: collectedDisposer
      });
      set({
        ...capability,
        registered: collectedDisposer,
        available: availability.available,
        unavailableReason: availability.unavailableReason
      });
    },
    refresh() {
      set(detect());
      return capability;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

// src/client/LeanspecSidebarTab.ts
function LeanspecSidebarTab() {
  (0, import_react3.useEffect)(() => {
    noteTabMounted();
    return () => {
      noteTabUnmounted();
    };
  }, []);
  return (0, import_react3.createElement)(LeanspecTabView);
}
function LeanspecTabView() {
  return (0, import_react3.createElement)(
    "div",
    { className: "dsh-leanspec-tab" },
    (0, import_react3.createElement)(LeanspecViewer, {})
  );
}
function LeanspecTabTitle() {
  return (0, import_react3.createElement)("span", { className: "dsh-leanspec-tab-title" }, LEANSPEC_TAB_TITLE);
}

// src/client/tab-registration.ts
var REQUIRED_SERVICES = ["sidebarRightTabs", "sidebarRight"];
function hostFunction(host2, key) {
  const value = read(host2, key);
  return isCallable(value) ? value : void 0;
}
var host = null;
var opener = null;
var controller = createTabController(() => detectTabCapability(host));
function markUnavailable() {
  controller.markOpen(false);
  controller.noteRegistration(false);
}
function forgetHost() {
  opener = null;
  host = null;
  controller.refresh();
  markUnavailable();
}
function tabCapability() {
  return controller.capability();
}
function subscribeTabCapability(listener) {
  return controller.subscribe(listener);
}
function leanspecTabIsOpen() {
  return controller.isOpen();
}
function openLeanspecTab(options) {
  if (opener === null) {
    return {
      ok: false,
      reason: controller.capability().unavailableReason ?? TAB_UNAVAILABLE_REGISTRATION
    };
  }
  return opener(options);
}
function switchToTab(options = {}) {
  const result = openLeanspecTab();
  if (!result.ok) return result;
  let next = reduceViewer(viewerStore.getState(), { type: "set-surface", surface: "tab" });
  if (options.pin === true) next = reduceViewer(next, { type: "set-pinned", pinned: true });
  viewerStore.setState(next);
  return result;
}
function noteTabMounted() {
  controller.markOpen(true);
  const current = viewerStore.getState();
  let next = reduceViewer(current, { type: "set-surface", surface: "tab" });
  if (current.pinned) next = reduceViewer(next, { type: "set-pinned", pinned: true });
  viewerStore.setState(next);
}
function noteTabUnmounted() {
  controller.markOpen(false);
  viewerStore.setState(reduceViewer(viewerStore.getState(), {
    type: "set-surface",
    surface: "popup"
  }));
}
function applySidebarTab(ctx) {
  host = ctx;
  controller.refresh();
  const inject2 = hostFunction(ctx, "inject");
  if (inject2 === void 0) {
    forgetHost();
    return () => {
      forgetHost();
    };
  }
  let disposeScope;
  try {
    const returned = inject2.call(ctx, REQUIRED_SERVICES, (scope) => {
      bindSidebarTab(scope);
    });
    if (isCallable(returned)) disposeScope = returned;
  } catch {
    forgetHost();
  }
  return () => {
    if (disposeScope !== void 0) {
      try {
        disposeScope();
      } catch {
      }
    }
    forgetHost();
  };
}
function bindSidebarTab(scope) {
  const cleanups = [];
  const rollback = () => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch {
      }
    }
    opener = null;
    markUnavailable();
  };
  try {
    const tabs = readService(scope, "sidebarRightTabs");
    const sidebar = readService(scope, "sidebarRight");
    const slots = readService(scope, "slots");
    const registerType = hostFunction(tabs, "register");
    const openTab = hostFunction(sidebar, "openTab");
    const injectSlot = hostFunction(slots, "inject");
    const registerSeat = hostFunction(slots, "register");
    const effect = hostFunction(scope, "effect");
    if (registerType === void 0 || openTab === void 0 || injectSlot === void 0 || registerSeat === void 0 || effect === void 0) {
      rollback();
      return;
    }
    host = scope;
    controller.refresh();
    const own = (callback, label) => {
      const dispose = effect.call(scope, callback, label);
      return isCallable(dispose) ? dispose : () => void 0;
    };
    const seat = (name2, component) => own(() => injectSlot.call(slots, name2, () => registerSeat.call(slots, {
      name: name2,
      key: LEANSPEC_TAB_ID
    }, component)), `leanspec: ${name2}`);
    cleanups.push(own(
      () => registerType.call(tabs, leanspecTabDefinition()),
      "leanspec: sidebar tab type"
    ));
    cleanups.push(seat("sidebar.right.pane.tab", LeanspecSidebarTab));
    cleanups.push(seat("sidebar.right.pane.tab.title", LeanspecTabTitle));
    cleanups.push(own(() => {
      opener = createOpener(sidebar, openTab);
      return () => {
        opener = null;
      };
    }, "leanspec: sidebar tab opener"));
    cleanups.push(own(() => () => {
      markUnavailable();
    }, "leanspec: sidebar tab availability"));
    controller.noteRegistration(true);
  } catch {
    rollback();
  }
}
function createOpener(sidebar, openTab) {
  return (options) => {
    const args = { params: options?.params ?? {} };
    if (options?.revealIfOpened !== void 0) args.revealIfOpened = options.revealIfOpened;
    try {
      openTab.call(sidebar, LEANSPEC_TAB_KIND, args);
      controller.markOpen(true);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "\u53F3\u680F\u6807\u7B7E\u6253\u5F00\u5931\u8D25" };
    }
  };
}

// src/client/LeanspecHeaderAction.ts
function LeanspecHeaderAction(props = {}) {
  const [state, dispatch] = useViewerStore();
  const [capability, setCapability] = (0, import_react4.useState)(() => tabCapability());
  const [failure, setFailure] = (0, import_react4.useState)(null);
  const [anchor, setAnchor] = (0, import_react4.useState)(void 0);
  const rootRef = (0, import_react4.useRef)(null);
  const followerRef = (0, import_react4.useRef)(null);
  const useWorkspaces = props.useWorkspaces ?? fallbackWorkspaces;
  const useSessions = props.useSessions ?? fallbackSessions;
  const useSidebarMounted = props.useSidebarMounted;
  const sidebarMounted = useSidebarMounted === void 0 ? true : useSidebarMounted((session) => session !== void 0) === true;
  const sidebarMountedRef = (0, import_react4.useRef)(sidebarMounted);
  const workspaceState = useWorkspaces((state2) => ({
    items: state2.items ?? [],
    ready: state2.baselinesReady !== false
  }));
  const sessionCwd = useSessions((state2) => state2.byId?.[String(props.sessionId ?? "")]?.cwd);
  const projectRoot = projectRootFromSlot({
    sessionId: props.sessionId,
    workspaces: workspaceState.items,
    sessionCwd
  });
  const projectReady = workspaceState.ready;
  const open = state.popupOpen;
  (0, import_react4.useEffect)(() => {
    ensureLeanspecStyles();
  }, []);
  (0, import_react4.useEffect)(() => subscribeTabCapability(() => {
    setCapability(tabCapability());
  }), []);
  (0, import_react4.useEffect)(() => {
    viewerStore.setState(reduceViewer(viewerStore.getState(), {
      type: "set-project",
      root: projectRoot ?? "",
      ready: projectReady
    }));
  }, [projectRoot, projectReady]);
  (0, import_react4.useEffect)(() => {
    if (!open) return;
    const closePopover = () => {
      viewerStore.setState(reduceViewer(viewerStore.getState(), {
        type: "set-popup-open",
        open: false
      }));
    };
    const onPointer = (event) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      closePopover();
    };
    const onKey = (event) => {
      if (event.key === "Escape") closePopover();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const measureAnchor = () => {
    const node = rootRef.current;
    return anchorBottomFromTrigger(node?.getBoundingClientRect?.().bottom);
  };
  const measureViewport = () => ({
    viewportWidth: typeof window === "undefined" ? Number.NaN : window.innerWidth,
    viewportHeight: typeof window === "undefined" ? Number.NaN : window.innerHeight
  });
  (0, import_react4.useEffect)(() => {
    sidebarMountedRef.current = sidebarMounted;
  }, [sidebarMounted]);
  const decideNow = () => decideSurface({ ...measureViewport(), anchorBottom: measureAnchor() });
  (0, import_react4.useEffect)(() => {
    const follower = createSurfaceFollower({
      measure: () => ({ ...measureViewport(), anchorBottom: measureAnchor() }),
      mounted: () => sidebarMountedRef.current,
      read: () => {
        const current = viewerStore.getState();
        return {
          surface: current.surface,
          pinned: current.pinned,
          dragging: current.dragging,
          panelVisible: current.popupOpen || leanspecTabIsOpen(),
          tabOpen: leanspecTabIsOpen(),
          tabAvailable: tabCapability().available
        };
      },
      apply: (surface) => {
        if (surface === "tab") {
          switchToTab();
          return;
        }
        viewerStore.setState(reduceViewer(viewerStore.getState(), {
          type: "set-popup-open",
          open: true
        }));
      },
      notify: setFailure,
      onTick: () => {
        setAnchor(measureAnchor());
      }
    });
    followerRef.current = follower;
    setAnchor(measureAnchor());
    follower.evaluate();
    return () => {
      followerRef.current = null;
      follower.dispose();
    };
  }, []);
  (0, import_react4.useEffect)(() => {
    followerRef.current?.evaluate();
  }, [state.dragging, sidebarMounted]);
  const actions = headerActions({
    dispatch,
    setFailure,
    decide: decideNow,
    tabAvailable: () => tabCapability().available
  });
  return (0, import_react4.createElement)(
    "div",
    { ref: rootRef, className: "dsh-leanspec-root" },
    (0, import_react4.createElement)(LeanspecHeaderView, {
      open,
      surface: state.surface,
      capability,
      failure,
      projectRoot,
      projectReady,
      anchor,
      onToggle: actions.togglePopover,
      onSwitchToTab: actions.switchToTab
    })
  );
}
function headerActions(deps) {
  const decide = deps.decide ?? (() => "popup");
  const tabAvailable = deps.tabAvailable ?? (() => true);
  const openPopover = () => {
    deps.dispatch({ type: "set-popup-open", open: true });
  };
  return {
    /** Open the panel by decision, or close the popup that is already up. */
    togglePopover() {
      if (viewerStore.getState().popupOpen) {
        deps.dispatch({ type: "set-popup-open", open: false });
        return;
      }
      if (leanspecTabIsOpen()) {
        const focused = switchToTab();
        deps.setFailure(focused.ok ? null : focused.reason);
        return;
      }
      if (decide() === "tab" && tabAvailable()) {
        const result = switchToTab();
        deps.setFailure(result.ok ? null : result.reason);
        if (!result.ok) openPopover();
        return;
      }
      deps.setFailure(null);
      openPopover();
    },
    /**
     * Popup → tab (T2.3), the manual switch. A refusal is reported on the button
     * instead of doing nothing: the tab may be unusable because of the host, not
     * the user (REQ-8.2). `switchToTab` only dismisses the popup after a
     * success, so a failure leaves the popup exactly where it was.
     *
     * This is the one place a surface is pinned: it is the user speaking
     * (REQ-1.7, T3.2).
     */
    switchToTab() {
      const result = switchToTab({ pin: true });
      deps.setFailure(result.ok ? null : result.reason);
    }
  };
}
function LeanspecHeaderView(props) {
  const disabled = !props.capability.available;
  const popover = props.open && props.surface === "popup";
  const anchorStyle = props.anchor === void 0 ? void 0 : { "--anchor": `${props.anchor}px` };
  const notices = [
    disabled ? props.capability.unavailableReason ?? "" : "",
    props.failure ?? ""
  ].filter((text) => text !== "");
  return (0, import_react4.createElement)(
    import_react4.Fragment,
    null,
    (0, import_react4.createElement)(
      "button",
      {
        type: "button",
        className: `dsh-leanspec-trigger${props.open ? " is-open" : ""}`,
        "aria-expanded": props.open,
        "aria-haspopup": "dialog",
        onClick: props.onToggle
      },
      "LeanSpec"
    ),
    popover ? (0, import_react4.createElement)(
      "div",
      {
        role: "dialog",
        "aria-label": "LeanSpec",
        className: "dsh-leanspec-popover",
        style: anchorStyle
      },
      notices.length === 0 ? null : (0, import_react4.createElement)(
        "div",
        { className: "dsh-leanspec-switchbar" },
        notices.map((text, index) => (0, import_react4.createElement)("span", { key: index, className: "dsh-leanspec-notice-text" }, text))
      ),
      (0, import_react4.createElement)(LeanspecViewer, {
        projectRoot: props.projectRoot,
        projectReady: props.projectReady,
        // Same line as the `LeanSpec` label, right-aligned inside the
        // directory column (2026-10-08 adjustment).
        headAction: (0, import_react4.createElement)(
          "button",
          {
            type: "button",
            className: "dsh-leanspec-switch",
            "data-leanspec-switch": "tab",
            disabled,
            title: props.capability.unavailableReason ?? "\u5728\u53F3\u680F\u6807\u7B7E\u91CC\u6253\u5F00 LeanSpec",
            // Two visible characters on purpose (2026-10-08): the control
            // shares its row with the pane title, and at the 180px splitter
            // floor a five-character label wrapped. The full sentence lives
            // in the tooltip and the accessible name.
            "aria-label": props.capability.unavailableReason ?? "\u5728\u53F3\u680F\u6807\u7B7E\u91CC\u6253\u5F00 LeanSpec",
            onClick: props.onSwitchToTab
          },
          "\u53F3\u680F \u29C9"
        )
      })
    ) : null
  );
}

// src/client/index.ts
var inject = ["slots"];
var name = "leanspec-web-viewer-client";
function apply(ctx) {
  const injectMountedHook = () => {
    try {
      const sidebar = ctx.get?.("sidebarRight");
      if (sidebar?.mounted === void 0) return {};
      return { hooks: { sidebarMounted: sidebar.mounted } };
    } catch {
      return {};
    }
  };
  ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
    name: "conversation.session.header.utilities",
    id: "leanspec-web-viewer",
    order: 10,
    label: "LeanSpec",
    inject: () => injectMountedHook()
  }, LeanspecHeaderAction));
  applySidebarTab(ctx);
}
return module.exports; } });

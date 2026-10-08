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

// node_modules/.pnpm/marked@18.1.0/node_modules/marked/lib/marked.esm.js
function I() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var P = I();
function W(l3) {
  P = l3;
}
var A = { exec: () => null };
function C(l3) {
  let e = [];
  return (t) => {
    let n = Math.max(0, Math.min(3, t - 1)), s = e[n];
    return s || (s = l3(n), e[n] = s), s;
  };
}
function h(l3, e = "") {
  let t = typeof l3 == "string" ? l3 : l3.source, n = { replace: (s, r) => {
    let o = typeof r == "string" ? r : r.source;
    return o = o.replace(x.caret, "$1"), t = t.replace(s, o), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var _e = ((l3 = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + l3);
  } catch {
    return false;
  }
})();
var x = { codeRemoveIndent: /^(?: {0,3}\t| {1,4})/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, endingSpaceTabChar: /[ \t]$/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, leadingSpaceTab: /^[ \t]+/, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, numericCharacterReference: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/g, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (l3) => new RegExp(`^( {0,3}${l3})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: C((l3) => new RegExp(`^ {0,${l3}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: C((l3) => new RegExp(`^ {0,${l3}}((?:-[ 	]*){3,}|(?:_[ 	]*){3,}|(?:\\*[ 	]*){3,})(?:\\n+|$)`)), fencesBeginRegex: C((l3) => new RegExp(`^ {0,${l3}}(?:\`\`\`|~~~)`)), headingBeginRegex: C((l3) => new RegExp(`^ {0,${l3}}#`)), htmlBeginRegex: C((l3) => new RegExp(`^ {0,${l3}}(?:</?(?:${N})(?: +|$|/?>)|<(?:script|pre|style|textarea|!--))`, "i")), blockquoteBeginRegex: C((l3) => new RegExp(`^ {0,${l3}}>`)) };
var $e = /^(?:[ \t]*(?:\n|$))+/;
var Le = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var ze = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var G = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var Ae = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var J = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
var he = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |fences|blockquote|heading|hr|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var de = h(he).replace(/bull/g, J).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var Ee = h(he).replace(/bull/g, J).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var V = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/;
var Me = /^[^\n]+/;
var Y = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
var Ie = h(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", Y).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var Ce = h(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, J).getRegex();
var N = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var ee = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var Be = h("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][a-z0-9-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", ee).replace("tag", N).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var ke = (l3) => h(V).replace("hr", G).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", l3).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", N).getRegex();
var De = ke(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/);
var qe = ke(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/);
var ve = h(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", qe).getRegex();
var te = { blockquote: ve, code: Le, def: Ie, fences: ze, heading: Ae, hr: G, html: Be, lheading: de, list: Ce, newline: $e, paragraph: De, table: A, text: Me };
var ue = h("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", G).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", N).getRegex();
var Ze = { ...te, lheading: Ee, table: ue, paragraph: h(V).replace("hr", G).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", ue).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", N).getRegex() };
var He = { ...te, html: h(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", ee).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: A, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: h(V).replace("hr", G).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", de).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() };
var Ge = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var Ne = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var ge = /^( {2,}|\\)\n(?!\s*$)[ \t]*/;
var Qe = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var $ = /[\p{P}\p{S}]/u;
var B = /[\s\p{P}\p{S}]/u;
var Q = /[^\s\p{P}\p{S}]/u;
var je = h(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, B).getRegex();
var Fe = /[\p{Pi}\p{Ps}"']/u;
var fe = /(?!~)[\p{P}\p{S}]/u;
var Ue = /(?!~)[\s\p{P}\p{S}]/u;
var Ke = /(?:[^\s\p{P}\p{S}]|~)/u;
var We = h(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", _e ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var me = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
var Xe = h(me, "u").replace(/punct/g, $).getRegex();
var Je = h(me, "u").replace(/punct/g, fe).getRegex();
var Ve = /^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/;
var Ye = h(Ve, "u").replace(/openQuote/g, Fe).replace(/punct/g, $).getRegex();
var xe = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var et = h(xe, "gu").replace(/notPunctSpace/g, Q).replace(/punctSpace/g, B).replace(/punct/g, $).getRegex();
var tt = h(xe, "gu").replace(/notPunctSpace/g, Ke).replace(/punctSpace/g, Ue).replace(/punct/g, fe).getRegex();
var nt = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)[\\s](\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)";
var rt = h(nt, "gu").replace(/notPunctSpace/g, Q).replace(/punctSpace/g, B).replace(/punct/g, $).getRegex();
var st = h("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, Q).replace(/punctSpace/g, B).replace(/punct/g, $).getRegex();
var it = "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)[\\s](_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)";
var ot = h(it, "gu").replace(/notPunctSpace/g, Q).replace(/punctSpace/g, B).replace(/punct/g, $).getRegex();
var at = h(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, $).getRegex();
var lt = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)";
var ut = h(lt, "gu").replace(/notPunctSpace/g, Q).replace(/punctSpace/g, B).replace(/punct/g, $).getRegex();
var pt = h(/\\(punct)/, "gu").replace(/punct/g, $).getRegex();
var ct = h(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var ht = h(ee).replace("(?:-->|$)", "-->").getRegex();
var dt = h("^comment|^</[a-zA-Z][a-zA-Z0-9-]*\\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", ht).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var be = /\[(?:\\[\s\S]|[^\[\]\\])*\]/;
var U = h(/(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/).replace("brackets", be).getRegex();
var kt = h(/^!?\[(label)\]\([ \t\n]*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?[ \t\n]*\)/).replace("label", U).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var gt = h(/^!?\[(label)\]\[(ref)\]/).replace("label", U).replace("ref", Y).getRegex();
var ft = h(/^!?\[(ref)\](?:\[\])?/).replace("ref", Y).getRegex();
var pe = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999}/;
var mt = h(/(?:[^\[\]\\`]*(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?/).replace("brackets", be).getRegex();
var xt = h("reflink|nolink(?!\\()", "g").replace("reflink", h(/^!?\[(label)\]\[(ref)\]/).replace("label", mt).replace("ref", pe).getRegex()).replace("nolink", h(/^!?\[(ref)\](?:\[\])?/).replace("ref", pe).getRegex()).getRegex();
var ce = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var bt = /[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/;
var Rt = h(/(?:mailto:email|xmpp:email(?:\/[A-Za-z0-9@.]+)?)/).replace(/email/g, bt).getRegex();
var ne = { _backpedal: A, anyPunctuation: pt, autolink: ct, blockSkip: We, br: ge, code: Ne, del: A, delLDelim: A, delRDelim: A, emStrongLDelim: Xe, emStrongRDelimAst: et, emStrongRDelimUnd: st, escape: Ge, link: kt, nolink: ft, punctuation: je, reflink: gt, reflinkSearch: xt, tag: dt, text: Qe, url: A };
var Tt = { ...ne, emStrongLDelim: Ye, emStrongRDelimAst: rt, emStrongRDelimUnd: ot, link: h(/^!?\[(label)\]\((.*?)\)/).replace("label", U).getRegex(), reflink: h(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", U).getRegex() };
var X = { ...ne, emStrongRDelimAst: tt, emStrongLDelim: Je, delLDelim: at, delRDelim: ut, url: h(/^emailProtocol|^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("emailProtocol", Rt).replace("protocol", ce).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: h(/^(?:[^a-zA-Z0-9](?=emailProtocol)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=emailProtocol)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/).replace("protocol", ce).replace(/emailProtocol/g, /(?:mailto|xmpp):/).getRegex() };
var Ot = { ...X, br: h(ge).replace("{2,}", "*").getRegex(), text: h(X.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var j = { normal: te, gfm: Ze, pedantic: He };
var D = { normal: ne, gfm: X, breaks: Ot, pedantic: Tt };
var wt = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var Re = (l3) => wt[l3];
function O(l3, e) {
  if (e) {
    if (x.escapeTest.test(l3)) return l3.replace(x.escapeReplace, Re);
  } else if (x.escapeTestNoEncode.test(l3)) return l3.replace(x.escapeReplaceNoEncode, Re);
  return l3;
}
function Te(l3) {
  return l3.replace(x.numericCharacterReference, (e, t, n) => {
    let s = t === void 0 ? Number.parseInt(n, 16) : Number.parseInt(t, 10);
    return s === 0 || s > 1114111 || s >= 55296 && s <= 57343 ? "\uFFFD" : String.fromCodePoint(s);
  });
}
function re(l3) {
  try {
    l3 = encodeURI(l3).replace(x.percentDecode, "%");
  } catch {
    return null;
  }
  return l3;
}
function se(l3, e) {
  let t = l3.replace(x.findPipe, (r, o, i) => {
    let u = false, a = o;
    for (; --a >= 0 && i[a] === "\\"; ) u = !u;
    return u ? "|" : " |";
  }), n = t.split(x.splitPipe), s = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e) if (n.length > e) n.splice(e);
  else for (; n.length < e; ) n.push("");
  for (; s < n.length; s++) n[s] = n[s].trim().replace(x.slashPipe, "|");
  return n;
}
function L(l3, e, t) {
  let n = l3.length;
  if (n === 0) return "";
  let s = 0;
  for (; s < n; ) {
    let r = l3.charAt(n - s - 1);
    if (r === e && !t) s++;
    else if (r !== e && t) s++;
    else break;
  }
  return l3.slice(0, n - s);
}
function ie(l3) {
  let e = l3.split(`
`), t = e.length - 1;
  for (; t >= 0 && x.blankLine.test(e[t]); ) t--;
  return e.length - t <= 2 ? l3 : e.slice(0, t + 1).join(`
`);
}
function q(l3) {
  return l3.trim().toLowerCase().toUpperCase().toLowerCase();
}
function oe(l3, e) {
  if (l3.indexOf(e[0]) === -1 && l3.indexOf(e[1]) === -1) return -1;
  let t = 0;
  for (let n = 0; n < l3.length; n++) if (l3[n] === "\\") n++;
  else if (l3[n] === e[0]) t++;
  else if (l3[n] === e[1] && (t--, t < 0)) return n;
  return t > 0 ? -2 : -1;
}
function ae(l3, e = 0) {
  let t = e, n = "";
  for (let s of l3) if (s === "	") {
    let r = 4 - t % 4;
    n += " ".repeat(r), t += r;
  } else n += s, t++;
  return n;
}
function Oe(l3, e, t, n, s) {
  let r = e.href, o = e.title || null, i = l3[1].replace(s.other.outputLinkReplace, "$1"), u = l3[0].charAt(0) === "!";
  n.state.inLink = true;
  let a = n.state.linkEmitted, p = n.state.inRawBlock;
  n.state.linkEmitted = false;
  let c = n.inlineTokens(i), d = n.state.linkEmitted;
  if (n.state.linkEmitted = a, n.state.inLink = false, !u) {
    if (d) {
      n.state.inRawBlock = p;
      return;
    }
    n.state.linkEmitted = true;
  }
  return { type: u ? "image" : "link", raw: t, href: r, title: o, text: i, tokens: c };
}
function Pt(l3, e, t) {
  let n = l3.match(t.other.indentCodeCompensation);
  if (n === null) return e;
  let s = n[1];
  return e.split(`
`).map((r) => {
    let o = r.match(t.other.beginningSpace);
    if (o === null) return r;
    let [i] = o;
    return r.slice(Math.min(i.length, s.length));
  }).join(`
`);
}
function we(l3, e, t, n) {
  if (!e.includes("<")) return false;
  for (let s = 0; s < e.length; s++) {
    if (e[s] === "\\") {
      s++;
      continue;
    }
    if (e[s] === "`") {
      let i = n.inline.code.exec(e.slice(s));
      if (i) {
        s += i[0].length - 1;
        continue;
      }
    }
    if (e[s] !== "<") continue;
    let r = l3.slice(t + s), o = n.inline.tag.exec(r) || n.inline.autolink.exec(r);
    if (o) {
      if (o[0].length > e.length - s) return true;
      s += o[0].length - 1;
    }
  }
  return false;
}
var y = class {
  options;
  rules;
  lexer;
  constructor(e) {
    this.options = e || P;
  }
  space(e) {
    let t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0) return { type: "space", raw: t[0] };
  }
  code(e) {
    let t = this.rules.block.code.exec(e);
    if (t) {
      let n = this.options.pedantic ? t[0] : ie(t[0]), s = n.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: n, codeBlockStyle: "indented", text: s };
    }
  }
  fences(e) {
    let t = this.rules.block.fences.exec(e);
    if (t) {
      let n = t[0], s = Pt(n, t[3] || "", this.rules);
      return { type: "code", raw: n, lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2], text: s };
    }
  }
  heading(e) {
    let t = this.rules.block.heading.exec(e);
    if (t) {
      let n = t[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let s = L(n, "#");
        (this.options.pedantic || !s || this.rules.other.endingSpaceTabChar.test(s)) && (n = s.trim());
      }
      return { type: "heading", raw: L(t[0], `
`), depth: t[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(e) {
    let t = this.rules.block.hr.exec(e);
    if (t) return { type: "hr", raw: L(t[0], `
`) };
  }
  blockquote(e) {
    let t = this.rules.block.blockquote.exec(e);
    if (t) {
      let n = L(t[0], `
`).split(`
`), s = "", r = "", o = [];
      for (; n.length > 0; ) {
        let i = false, u = [], a;
        for (a = 0; a < n.length; a++) if (this.rules.other.blockquoteStart.test(n[a])) u.push(n[a]), i = true;
        else if (!i) u.push(n[a]);
        else break;
        n = n.slice(a);
        let p = u.join(`
`), c = p.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        s = s ? `${s}
${p}` : p, r = r ? `${r}
${c}` : c;
        let d = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(c, o, true), this.lexer.state.top = d, n.length === 0) break;
        let m = o.at(-1);
        if (m?.type === "code") break;
        if (m?.type === "blockquote") {
          let b = m, g = n.join(`
`), w = b.raw + `
` + g.replace(this.rules.other.blockquoteSetextReplace2, ""), f = this.blockquote(w);
          o[o.length - 1] = f;
          let M = w.substring(f.raw.length).replace(/^\n/, ""), v = M ? M.split(`
`).length : 0, Z = v ? n.slice(0, -v) : n;
          Z.length > 0 && (s = `${s}
${Z.join(`
`)}`), r = r.substring(0, r.length - b.text.length) + f.text;
          break;
        } else if (m?.type === "list") {
          let b = m, g = b.raw + `
` + n.join(`
`), w = this.list(g);
          o[o.length - 1] = w, s = s.substring(0, s.length - m.raw.length) + w.raw, r = r.substring(0, r.length - b.raw.length) + w.raw, n = g.substring(o.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: s, tokens: o, text: r };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      let n = t[1].trim(), s = n.length > 1, r = { type: "list", raw: "", ordered: s, start: s ? +n.slice(0, -1) : "", loose: false, items: [] };
      n = s ? `\\d{1,9}\\${n.slice(-1)}` : `\\${n}`, this.options.pedantic && (n = s ? n : "[*+-]");
      let o = this.rules.other.listItemRegex(n), i = false;
      for (; e; ) {
        let a = false, p = "", c = "";
        if (!(t = o.exec(e)) || this.rules.block.hr.test(e)) break;
        p = t[0], e = e.substring(p.length);
        let d = t[2].split(`
`, 1)[0], m = t[1].length, b = this.options.pedantic ? ae(d, m) : d.replace(this.rules.other.leadingSpaceTab, (M) => ae(M, m)), g = e.split(`
`, 1)[0], w = !b.trim(), f = 0;
        if (this.options.pedantic ? (f = 2, c = b.trimStart()) : w ? f = m + 1 : (f = b.search(this.rules.other.nonSpaceChar), f = f > 4 ? 1 : f, c = b.slice(f), f += m), w && this.rules.other.blankLine.test(g) && (p += g + `
`, e = e.substring(g.length + 1), a = true), !a) {
          let M = this.rules.other.nextBulletRegex(f), v = this.rules.other.hrRegex(f), Z = this.rules.other.fencesBeginRegex(f), le = this.rules.other.headingBeginRegex(f), Pe = this.rules.other.htmlBeginRegex(f), ye = this.rules.other.blockquoteBeginRegex(f);
          for (; e; ) {
            let K = e.split(`
`, 1)[0], H;
            if (g = K, this.options.pedantic ? (g = g.replace(this.rules.other.listReplaceNesting, "  "), H = g) : H = g.replace(this.rules.other.leadingSpaceTab, (Se) => Se.replace(this.rules.other.tabCharGlobal, "    ")), Z.test(g) || le.test(g) || Pe.test(g) || ye.test(g) || M.test(g) || v.test(g)) break;
            if (H.search(this.rules.other.nonSpaceChar) >= f || !g.trim()) c += `
` + H.slice(f);
            else {
              if (w || b.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || Z.test(b) || le.test(b) || v.test(b)) break;
              c += `
` + g;
            }
            w = !g.trim(), p += K + `
`, e = e.substring(K.length + 1), b = H.slice(f);
          }
        }
        r.loose || (i ? r.loose = true : this.rules.other.doubleBlankLine.test(p) && (i = true)), r.items.push({ type: "list_item", raw: p, task: !!this.options.gfm && this.rules.other.listIsTask.test(c), loose: false, text: c, tokens: [] }), r.raw += p;
      }
      let u = r.items.at(-1);
      if (u) u.raw = u.raw.trimEnd(), u.text = u.text.trimEnd();
      else return;
      r.raw = r.raw.trimEnd();
      for (let a of r.items) if (this.lexer.state.top = false, a.tokens = this.lexer.blockTokens(a.text, []), !r.loose) {
        let p = a.tokens.filter((d) => d.type === "space"), c = p.length > 0 && p.some((d) => this.rules.other.anyLine.test(d.raw));
        r.loose = c;
      }
      for (let a of r.items) {
        let p = a.tokens[0];
        if (a.task && (p?.type === "text" || p?.type === "paragraph")) {
          a.text = a.text.replace(this.rules.other.listReplaceTask, ""), p.raw = p.raw.replace(this.rules.other.listReplaceTask, ""), p.text = p.text.replace(this.rules.other.listReplaceTask, "");
          for (let d = this.lexer.inlineQueue.length - 1; d >= 0; d--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[d].src)) {
            this.lexer.inlineQueue[d].src = this.lexer.inlineQueue[d].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let c = this.rules.other.listTaskCheckbox.exec(a.raw);
          if (c) {
            let d = { type: "checkbox", raw: c[0] + " ", checked: c[0] !== "[ ]" };
            a.checked = d.checked, r.loose ? a.tokens[0] && ["paragraph", "text"].includes(a.tokens[0].type) && "tokens" in a.tokens[0] && a.tokens[0].tokens ? (a.tokens[0].raw = d.raw + a.tokens[0].raw, a.tokens[0].text = d.raw + a.tokens[0].text, a.tokens[0].tokens.unshift(d)) : a.tokens.unshift({ type: "paragraph", raw: d.raw, text: d.raw, tokens: [d] }) : a.tokens.unshift(d);
          }
        } else a.task && (a.task = false);
      }
      if (r.loose) for (let a of r.items) {
        a.loose = true;
        for (let p of a.tokens) p.type === "text" && (p.type = "paragraph");
      }
      return r;
    }
  }
  html(e) {
    let t = this.rules.block.html.exec(e);
    if (t) {
      let n = ie(t[0]);
      return { type: "html", block: true, raw: n, pre: t[1] === "pre" || t[1] === "script" || t[1] === "style", text: n };
    }
  }
  def(e) {
    let t = this.rules.block.def.exec(e);
    if (t) {
      if (!this.rules.other.startAngleBracket.test(t[2]) && oe(t[2], "()") !== -1) return;
      let n = q(t[1]).replace(this.rules.other.multipleSpaceGlobal, " "), s = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return { type: "def", tag: n, raw: L(t[0], `
`), href: s, title: r };
    }
  }
  table(e) {
    let t = this.rules.block.table.exec(e);
    if (!t || !this.rules.other.tableDelimiter.test(t[2])) return;
    let n = se(t[1]), s = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), r = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], o = { type: "table", raw: L(t[0], `
`), header: [], align: [], rows: [] };
    if (n.length === s.length) {
      for (let i of s) this.rules.other.tableAlignRight.test(i) ? o.align.push("right") : this.rules.other.tableAlignCenter.test(i) ? o.align.push("center") : this.rules.other.tableAlignLeft.test(i) ? o.align.push("left") : o.align.push(null);
      for (let i = 0; i < n.length; i++) o.header.push({ text: n[i], tokens: this.lexer.inline(n[i]), header: true, align: o.align[i] });
      for (let i of r) o.rows.push(se(i, o.header.length).map((u, a) => ({ text: u, tokens: this.lexer.inline(u), header: false, align: o.align[a] })));
      return o;
    }
  }
  lheading(e) {
    let t = this.rules.block.lheading.exec(e);
    if (t) {
      let n = t[1].trim();
      return { type: "heading", raw: L(t[0], `
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
      if (!this.options.pedantic && we(e, t[1], n, this.rules)) return;
      let s = t[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(s)) {
        if (!this.rules.other.endAngleBracket.test(s)) return;
        let i = L(s.slice(0, -1), "\\");
        if ((s.length - i.length) % 2 === 0) return;
      } else {
        let i = oe(t[2], "()");
        if (i === -2) return;
        if (i > -1) {
          let a = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + i;
          t[2] = t[2].substring(0, i), t[0] = t[0].substring(0, a).trim(), t[3] = "";
        }
      }
      let r = t[2], o = "";
      if (this.options.pedantic) {
        let i = this.rules.other.pedanticHrefTitle.exec(r);
        i && (r = i[1], o = i[3]);
      } else o = t[3] ? t[3].slice(1, -1) : "";
      return r = r.trim(), this.rules.other.startAngleBracket.test(r) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(s) ? r = r.slice(1) : r = r.slice(1, -1)), Oe(t, { href: r && r.replace(this.rules.inline.anyPunctuation, "$1"), title: o && o.replace(this.rules.inline.anyPunctuation, "$1") }, t[0], this.lexer, this.rules);
    }
  }
  reflink(e, t) {
    let n;
    if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
      let s = n[0].charAt(0) === "!" ? 2 : 1;
      if (!this.options.pedantic && we(e, n[1], s, this.rules)) return;
      let r = (n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " "), o = t[q(r)];
      if (!o) {
        let i = n[0].charAt(0);
        return { type: "text", raw: i, text: i };
      }
      return Oe(n, o, n[0], this.lexer, this.rules);
    }
  }
  emStrong(e, t, n = "") {
    let s = this.rules.inline.emStrongLDelim.exec(e);
    if (!s || !s[1] && !s[2] && !s[3] && !s[4] || s[4] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
    if (!(s[1] || s[3] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let o = [...s[0]].length - 1, i, u, a = o, p = 0, c = s[0][0], d = n === c, m = c === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (m.lastIndex = 0, t = t.slice(-1 * e.length + o); (s = m.exec(t)) !== null; ) {
        if (i = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !i) continue;
        if (u = [...i].length, s[3] || s[4]) {
          a += u;
          continue;
        } else if (s[5] || s[6]) {
          if (o % 3 && !((o + u) % 3)) {
            p += u;
            continue;
          }
          if (d) break;
        }
        if (a -= u, a > 0) continue;
        u = Math.min(u, u + a + p);
        let b = [...s[0]][0].length, g = e.slice(0, o + s.index + b + u);
        if (Math.min(o, u) % 2) {
          let f = g.slice(1, -1);
          return { type: "em", raw: g, text: f, tokens: this.lexer.inlineTokens(f) };
        }
        let w = g.slice(2, -2);
        return { type: "strong", raw: g, text: w, tokens: this.lexer.inlineTokens(w) };
      }
    }
  }
  codespan(e) {
    let t = this.rules.inline.code.exec(e);
    if (t) {
      let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), s = this.rules.other.nonSpaceChar.test(n), r = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return s && r && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: t[0], text: n };
    }
  }
  br(e) {
    let t = this.rules.inline.br.exec(e);
    if (t) return { type: "br", raw: t[0] };
  }
  del(e, t, n = "") {
    let s = this.rules.inline.delLDelim.exec(e);
    if (!s) return;
    if (!(s[1] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let o = [...s[0]].length - 1, i, u, a = o, p = this.rules.inline.delRDelim;
      for (p.lastIndex = 0, t = t.slice(-1 * e.length + o); (s = p.exec(t)) !== null; ) {
        if (i = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !i || (u = [...i].length, u !== o)) continue;
        if (s[3] || s[4]) {
          a += u;
          continue;
        }
        if (a -= u, a > 0) continue;
        u = Math.min(u, u + a);
        let c = [...s[0]][0].length, d = e.slice(0, o + s.index + c + u), m = d.slice(o, -o);
        return { type: "del", raw: d, text: m, tokens: this.lexer.inlineTokens(m) };
      }
    }
  }
  autolink(e) {
    let t = this.rules.inline.autolink.exec(e);
    if (t) {
      let n, s;
      return t[2] === "@" ? (n = t[1], s = "mailto:" + n) : (n = t[1], s = n), { type: "link", raw: t[0], text: n, href: s, autolink: true, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(e) {
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let n, s;
      if (t[2] === "@") n = t[0], s = "mailto:" + n;
      else {
        let r;
        do
          r = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
        while (r !== t[0]);
        n = t[0], t[1] === "www." ? s = "http://" + t[0] : s = t[0];
      }
      return { type: "link", raw: t[0], text: n, href: s, autolink: true, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(e) {
    let t = this.rules.inline.text.exec(e);
    if (t) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: t[0], text: n ? t[0] : Te(t[0]), escaped: n };
    }
  }
};
var R = class l {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(e) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e || P, this.options.tokenizer = this.options.tokenizer || new y(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, linkEmitted: false, linkParenPossible: true, top: true };
    let t = { other: x, block: j.normal, inline: D.normal };
    this.options.pedantic ? (t.block = j.pedantic, t.inline = D.pedantic) : this.options.gfm && (t.block = j.gfm, this.options.breaks ? t.inline = D.breaks : t.inline = D.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: j, inline: D };
  }
  static lex(e, t) {
    return new l(t).lex(e);
  }
  static lexInline(e, t) {
    return new l(t).inlineTokens(e);
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
    let s = 1 / 0;
    for (; e; ) {
      if (e.length < s) s = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      let r;
      if (this.options.extensions?.block?.some((i) => (r = i.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), true) : false)) continue;
      if (r = this.tokenizer.space(e)) {
        e = e.substring(r.raw.length);
        let i = t.at(-1);
        r.raw.length === 1 && i !== void 0 ? i.raw += `
` : t.push(r);
        continue;
      }
      if (r = this.tokenizer.code(e)) {
        e = e.substring(r.raw.length);
        let i = t.at(-1);
        i?.type === "paragraph" || i?.type === "text" ? (i.raw += (i.raw.endsWith(`
`) ? "" : `
`) + r.raw, i.text += `
` + r.text, this.inlineQueue.at(-1).src = i.text) : t.push(r);
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
        let i = t.at(-1);
        i?.type === "paragraph" || i?.type === "text" ? (i.raw += (i.raw.endsWith(`
`) ? "" : `
`) + r.raw, i.text += `
` + r.raw, this.inlineQueue.at(-1).src = i.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = { href: r.href, title: r.title }, t.push(r));
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
        let i = 1 / 0, u = e.slice(1), a;
        this.options.extensions.startBlock.forEach((p) => {
          a = p.call({ lexer: this }, u), typeof a == "number" && a >= 0 && (i = Math.min(i, a));
        }), i < 1 / 0 && i >= 0 && (o = e.substring(0, i + 1));
      }
      if (this.state.top && (r = this.tokenizer.paragraph(o))) {
        let i = t.at(-1);
        n && i?.type === "paragraph" ? (i.raw += (i.raw.endsWith(`
`) ? "" : `
`) + r.raw, i.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = i.text) : t.push(r), n = o.length !== e.length, e = e.substring(r.raw.length);
        continue;
      }
      if (r = this.tokenizer.text(e)) {
        e = e.substring(r.raw.length);
        let i = t.at(-1);
        i?.type === "text" ? (i.raw += (i.raw.endsWith(`
`) ? "" : `
`) + r.raw, i.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = i.text) : t.push(r);
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
      let s = n[0], r = s.lastIndexOf("[");
      if (!(s.charAt(0) === "!" || !Object.hasOwn(this.tokens.links, q(s.slice(r + 1, -1)))) && !(r > 1 && this.linkInText(s.slice(1, r - 1)))) return true;
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
      let i = this.tokenizer.rules.inline.reflinkSearch, u = (a) => {
        let p = a.lastIndexOf("[");
        if (!Object.hasOwn(this.tokens.links, q(a.slice(p + 1, -1)))) return a;
        if (p > 1 && a.charAt(0) !== "!") {
          let c = a.slice(1, p - 1);
          if (this.linkInText(c)) return "[" + c.replace(i, u) + "][" + "a".repeat(a.length - p - 2) + "]";
        }
        return "[" + "a".repeat(a.length - 2) + "]";
      };
      n = n.replace(i, u);
    }
    n = n.replace(this.tokenizer.rules.inline.anyPunctuation, (i) => "+".repeat(i.length)), n = n.replace(this.tokenizer.rules.inline.blockSkip, (i, u, a) => {
      let p = a ? a.length : 0;
      return i.slice(0, p) + "[" + "a".repeat(i.length - p - 2) + "]";
    }), n = this.options.hooks?.emStrongMask?.call({ lexer: this }, n) ?? n;
    let s = false, r = "", o = 1 / 0;
    for (; e; ) {
      if (e.length < o) o = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      s || (r = ""), s = false;
      let i;
      if (this.options.extensions?.inline?.some((a) => (i = a.call({ lexer: this }, e, t)) ? (e = e.substring(i.raw.length), t.push(i), true) : false)) continue;
      if (i = this.tokenizer.escape(e)) {
        e = e.substring(i.raw.length), t.push(i);
        continue;
      }
      if (i = this.tokenizer.tag(e)) {
        e = e.substring(i.raw.length), t.push(i);
        continue;
      }
      if (i = this.tokenizer.link(e)) {
        e = e.substring(i.raw.length), t.push(i);
        continue;
      }
      if (i = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(i.raw.length);
        let a = t.at(-1);
        i.type === "text" && a?.type === "text" ? (a.raw += i.raw, a.text += i.text) : t.push(i);
        continue;
      }
      if (i = this.tokenizer.emStrong(e, n, r)) {
        e = e.substring(i.raw.length), t.push(i);
        continue;
      }
      if (i = this.tokenizer.codespan(e)) {
        e = e.substring(i.raw.length), t.push(i);
        continue;
      }
      if (i = this.tokenizer.br(e)) {
        e = e.substring(i.raw.length), t.push(i);
        continue;
      }
      if (i = this.tokenizer.del(e, n, r)) {
        e = e.substring(i.raw.length), t.push(i);
        continue;
      }
      if (i = this.tokenizer.autolink(e)) {
        e = e.substring(i.raw.length), t.push(i);
        continue;
      }
      if (!this.state.inLink && (i = this.tokenizer.url(e))) {
        e = e.substring(i.raw.length), t.push(i);
        continue;
      }
      let u = e;
      if (this.options.extensions?.startInline) {
        let a = 1 / 0, p = e.slice(1), c;
        this.options.extensions.startInline.forEach((d) => {
          c = d.call({ lexer: this }, p), typeof c == "number" && c >= 0 && (a = Math.min(a, c));
        }), a < 1 / 0 && a >= 0 && (u = e.substring(0, a + 1));
      }
      if (i = this.tokenizer.inlineText(u)) {
        e = e.substring(i.raw.length), i.raw.slice(-1) !== "_" && (r = i.raw.slice(-1)), s = true;
        let a = t.at(-1);
        a?.type === "text" ? (a.raw += i.raw, a.text += i.text) : t.push(i);
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
var S = class {
  options;
  parser;
  constructor(e) {
    this.options = e || P;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: n }) {
    let s = (t || "").match(x.notSpaceStart)?.[0], r = e ? e.replace(x.endingNewline, "") + `
` : "";
    return s ? '<pre><code class="language-' + O(s) + '">' + (n ? r : O(r, true)) + `</code></pre>
` : "<pre><code>" + (n ? r : O(r, true)) + `</code></pre>
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
    let t = e.ordered, n = e.start, s = "";
    for (let i = 0; i < e.items.length; i++) {
      let u = e.items[i];
      s += this.listitem(u);
    }
    let r = t ? "ol" : "ul", o = t && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + r + o + `>
` + s + "</" + r + `>
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
    let s = "";
    for (let r = 0; r < e.rows.length; r++) {
      let o = e.rows[r];
      n = "";
      for (let i = 0; i < o.length; i++) n += this.tablecell(o[i]);
      s += this.tablerow({ text: n });
    }
    return s && (s = `<tbody>${s}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + s + `</table>
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
    return `<code>${O(e, true)}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, text: n, tokens: s, autolink: r }) {
    let o = r ? O(n, true) : this.parser.parseInline(s), i = re(e);
    if (i === null) return o;
    e = O(i, r);
    let u = '<a href="' + e + '"';
    return t && (u += ' title="' + O(t) + '"'), u += ">" + o + "</a>", u;
  }
  image({ href: e, title: t, text: n, tokens: s }) {
    s && (n = this.parser.parseInline(s, this.parser.textRenderer));
    let r = re(e);
    if (r === null) return O(n);
    e = r;
    let o = `<img src="${O(e)}" alt="${O(n)}"`;
    return t && (o += ` title="${O(t)}"`), o += ">", o;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : "escaped" in e && e.escaped ? e.text : O(e.text);
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
var T = class l2 {
  options;
  renderer;
  textRenderer;
  constructor(e) {
    this.options = e || P, this.options.renderer = this.options.renderer || new S(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new z();
  }
  static parse(e, t) {
    return new l2(t).parse(e);
  }
  static parseInline(e, t) {
    return new l2(t).parseInline(e);
  }
  parse(e) {
    this.renderer.parser = this;
    let t = "";
    for (let n = 0; n < e.length; n++) {
      let s = e[n];
      if (this.options.extensions?.renderers?.[s.type]) {
        let o = s, i = this.options.extensions.renderers[o.type].call({ parser: this }, o);
        if (i !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "checkbox", "html", "def", "paragraph", "text"].includes(o.type)) {
          t += i || "";
          continue;
        }
      }
      let r = s;
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
    for (let s = 0; s < e.length; s++) {
      let r = e[s];
      if (this.options.extensions?.renderers?.[r.type]) {
        let i = this.options.extensions.renderers[r.type].call({ parser: this }, r);
        if (i !== false || !["escape", "html", "link", "image", "checkbox", "strong", "em", "codespan", "br", "del", "text"].includes(r.type)) {
          n += i || "";
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
          let i = 'Token with "' + o.type + '" type was not found.';
          if (this.options.silent) return console.error(i), "";
          throw new Error(i);
        }
      }
    }
    return n;
  }
};
var _ = class {
  options;
  block;
  constructor(e) {
    this.options = e || P;
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
    return e ? R.lex : R.lexInline;
  }
  provideParser(e = this.block) {
    return e ? T.parse : T.parseInline;
  }
};
var F = class {
  defaults = I();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = T;
  Renderer = S;
  TextRenderer = z;
  Lexer = R;
  Tokenizer = y;
  Hooks = _;
  constructor(...e) {
    this.use(...e);
  }
  walkTokens(e, t) {
    let n = [];
    for (let s of e) switch (n = n.concat(t.call(this, s)), s.type) {
      case "table": {
        let r = s;
        for (let o of r.header) n = n.concat(this.walkTokens(o.tokens, t));
        for (let o of r.rows) for (let i of o) n = n.concat(this.walkTokens(i.tokens, t));
        break;
      }
      case "list": {
        let r = s;
        n = n.concat(this.walkTokens(r.items, t));
        break;
      }
      default: {
        let r = s;
        this.defaults.extensions?.childTokens?.[r.type] ? this.defaults.extensions.childTokens[r.type].forEach((o) => {
          let i = r[o].flat(1 / 0);
          n = n.concat(this.walkTokens(i, t));
        }) : r.tokens && (n = n.concat(this.walkTokens(r.tokens, t)));
      }
    }
    return n;
  }
  use(...e) {
    let t = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e.forEach((n) => {
      let s = { ...n };
      if (s.async = this.defaults.async || s.async || false, n.extensions && (n.extensions.forEach((r) => {
        if (!r.name) throw new Error("extension name required");
        if ("renderer" in r) {
          let o = t.renderers[r.name];
          o ? t.renderers[r.name] = function(...i) {
            let u = r.renderer.apply(this, i);
            return u === false && (u = o.apply(this, i)), u;
          } : t.renderers[r.name] = r.renderer;
        }
        if ("tokenizer" in r) {
          if (!r.level || r.level !== "block" && r.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let o = t[r.level];
          o ? o.unshift(r.tokenizer) : t[r.level] = [r.tokenizer], r.start && (r.level === "block" ? t.startBlock ? t.startBlock.push(r.start) : t.startBlock = [r.start] : r.level === "inline" && (t.startInline ? t.startInline.push(r.start) : t.startInline = [r.start]));
        }
        "childTokens" in r && r.childTokens && (t.childTokens[r.name] = r.childTokens);
      }), s.extensions = t), n.renderer) {
        let r = this.defaults.renderer || new S(this.defaults);
        for (let o in n.renderer) {
          if (!(o in r)) throw new Error(`renderer '${o}' does not exist`);
          if (["options", "parser"].includes(o)) continue;
          let i = o, u = n.renderer[i], a = r[i];
          r[i] = (...p) => {
            let c = u.apply(r, p);
            return c === false && (c = a.apply(r, p)), c || "";
          };
        }
        s.renderer = r;
      }
      if (n.tokenizer) {
        let r = this.defaults.tokenizer || new y(this.defaults);
        for (let o in n.tokenizer) {
          if (!(o in r)) throw new Error(`tokenizer '${o}' does not exist`);
          if (["options", "rules", "lexer"].includes(o)) continue;
          let i = o, u = n.tokenizer[i], a = r[i];
          r[i] = (...p) => {
            let c = u.apply(r, p);
            return c === false && (c = a.apply(r, p)), c;
          };
        }
        s.tokenizer = r;
      }
      if (n.hooks) {
        let r = this.defaults.hooks || new _();
        for (let o in n.hooks) {
          if (!(o in r)) throw new Error(`hook '${o}' does not exist`);
          if (["options", "block"].includes(o)) continue;
          let i = o, u = n.hooks[i], a = r[i];
          _.passThroughHooks.has(o) ? r[i] = (p) => {
            if (this.defaults.async && _.passThroughHooksRespectAsync.has(o)) return (async () => {
              let d = await u.call(r, p);
              return a.call(r, d);
            })();
            let c = u.call(r, p);
            return a.call(r, c);
          } : r[i] = (...p) => {
            if (this.defaults.async) return (async () => {
              let d = await u.apply(r, p);
              return d === false && (d = await a.apply(r, p)), d;
            })();
            let c = u.apply(r, p);
            return c === false && (c = a.apply(r, p)), c;
          };
        }
        s.hooks = r;
      }
      if (n.walkTokens) {
        let r = this.defaults.walkTokens, o = n.walkTokens;
        s.walkTokens = function(i) {
          let u = [];
          return u.push(o.call(this, i)), r && (u = u.concat(r.call(this, i))), u;
        };
      }
      this.defaults = { ...this.defaults, ...s };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return R.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return T.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (n, s) => {
      let r = { ...s }, o = { ...this.defaults, ...r }, i = this.onError(!!o.silent, !!o.async);
      if (this.defaults.async === true && r.async === false) return i(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n > "u" || n === null) return i(new Error("marked(): input parameter is undefined or null"));
      if (typeof n != "string") return i(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
      if (o.hooks && (o.hooks.options = o, o.hooks.block = e), o.async) return (async () => {
        let u = o.hooks ? await o.hooks.preprocess(n) : n, p = await (o.hooks ? await o.hooks.provideLexer(e) : e ? R.lex : R.lexInline)(u, o), c = o.hooks ? await o.hooks.processAllTokens(p) : p;
        o.walkTokens && await Promise.all(this.walkTokens(c, o.walkTokens));
        let m = await (o.hooks ? await o.hooks.provideParser(e) : e ? T.parse : T.parseInline)(c, o);
        return o.hooks ? await o.hooks.postprocess(m) : m;
      })().catch(i);
      try {
        o.hooks && (n = o.hooks.preprocess(n));
        let a = (o.hooks ? o.hooks.provideLexer(e) : e ? R.lex : R.lexInline)(n, o);
        o.hooks && (a = o.hooks.processAllTokens(a)), o.walkTokens && this.walkTokens(a, o.walkTokens);
        let c = (o.hooks ? o.hooks.provideParser(e) : e ? T.parse : T.parseInline)(a, o);
        return o.hooks && (c = o.hooks.postprocess(c)), c;
      } catch (u) {
        return i(u);
      }
    };
  }
  onError(e, t) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        let s = "<p>An error occurred:</p><pre>" + O(n.message + "", true) + "</pre>";
        return t ? Promise.resolve(s) : s;
      }
      if (t) return Promise.reject(n);
      throw n;
    };
  }
};
var E = new F();
function k(l3, e) {
  return E.parse(l3, e);
}
k.options = k.setOptions = function(l3) {
  return E.setOptions(l3), k.defaults = E.defaults, W(k.defaults), k;
};
k.getDefaults = I;
k.defaults = P;
function yt(...l3) {
  return E.use(...l3), k.defaults = E.defaults, W(k.defaults), k;
}
k.use = yt;
k.walkTokens = function(l3, e) {
  return E.walkTokens(l3, e);
};
k.parseInline = E.parseInline;
k.Parser = T;
k.parser = T.parse;
k.Renderer = S;
k.TextRenderer = z;
k.Lexer = R;
k.lexer = R.lex;
k.Tokenizer = y;
k.Hooks = _;
k.parse = k;
var gn = k.options;
var fn = k.setOptions;
var mn = k.walkTokens;
var xn = k.parseInline;
var Rn = T.parse;
var Tn = R.lex;

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
  const html = k(body);
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
  projectReady: false
};
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
      return state.projectRoot === action.root && state.projectReady === action.ready ? state : { ...state, projectRoot: action.root, projectReady: action.ready };
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

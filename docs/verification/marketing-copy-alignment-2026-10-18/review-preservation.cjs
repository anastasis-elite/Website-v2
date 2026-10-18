const fs = require('node:fs')
const cp = require('node:child_process')
const ts = require('../../../node_modules/typescript')
const repo = require('node:path').resolve(__dirname, '../../..')
const base = '84b16efd3320ab15625f8dd4566df352d5f12ee4'
const git = (...args) => cp.execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
const files = git('diff', '--name-only', base, 'HEAD').trim().split('\n').filter(Boolean)
const tsFiles = files.filter(f => /\.(?:tsx?|mjs)$/.test(f) && /^(?:app|components|lib)\//.test(f))
function parse(f, text) { return ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : f.endsWith('.mjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS) }
function skeleton(n) {
  if (ts.isStringLiteralLike(n) || ts.isJsxText(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) return [n.kind, '<copy>']
  const own = ts.isIdentifier(n) || ts.isNumericLiteral(n) || ts.isRegularExpressionLiteral(n) ? n.text : undefined
  return [n.kind, own, ...n.getChildren().map(skeleton)]
}
function protectedValues(sf) {
 const out = { numbers: [], paths: [], attributes: [], modules: [], predicates: [], dataCalls: [] }
 const visit = n => {
  if (ts.isNumericLiteral(n)) out.numbers.push(n.text)
  if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
   const p=n.parent
   if (/^(?:\/|https?:\/\/|mailto:)/.test(n.text)) out.paths.push(n.text)
   if (ts.isJsxAttribute(p) && /^(?:href|src|className|id|name|type|value|role|data-.+)$/.test(p.name.text)) out.attributes.push([p.name.text,n.text])
   if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) out.modules.push(n.text)
   if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsToken,ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind) || ts.isCaseClause(p)) out.predicates.push(n.text)
   if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && /^(?:from|select|eq|neq|in|rpc|order|filter|contains|match|delete|update|insert|upsert)$/.test(p.expression.name.text)) out.dataCalls.push([p.expression.name.text,n.text])
  }
  ts.forEachChild(n, visit)
 }
 visit(sf); return out
}
const results=tsFiles.map(file=>{
 const before=parse(file,git('show',`${base}:${file}`)),after=parse(file,fs.readFileSync(repo+'/'+file,'utf8'))
 const a=protectedValues(before),b=protectedValues(after)
 return { file, copyNeutralAstEqual:JSON.stringify(skeleton(before))===JSON.stringify(skeleton(after)), protectedChanges:Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).map(k=>({kind:k,before:a[k],after:b[k]})) }
})
const protectedPaths=['lib/entitlements.ts','next.config.js','package.json','package-lock.json','supabase','migrations','lib/commerce','lib/nutrition/targetEngine.ts','lib/supabase','lib/legal','lib/strength','app/terms','app/privacy','app/refund-policy','app/health-disclaimer','app/ai-disclaimer','app/medical-clearance','app/informed-consent']
const drift=git('diff','--name-only',base,'--',...protectedPaths).trim().split('\n').filter(Boolean)
const report={base,branch:git('branch','--show-current').trim(),head:git('rev-parse','HEAD').trim(),sourceFiles:results.length,files:results,protectedPathDrift:drift,changedFiles:files}
fs.writeFileSync(__dirname+'/preservation.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({sourceFiles:results.length,astSame:results.filter(r=>r.copyNeutralAstEqual).length,astDifferent:results.filter(r=>!r.copyNeutralAstEqual).map(r=>r.file),protectedChanges:results.filter(r=>r.protectedChanges.length),protectedPathDrift:drift},null,2))

if (results.some(r => !r.copyNeutralAstEqual || r.protectedChanges.length) || drift.length) process.exitCode = 1

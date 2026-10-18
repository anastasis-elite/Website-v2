const fs = require('node:fs')
const cp = require('node:child_process')
const path = require('node:path')
const assert = require('node:assert/strict')
const repo = process.cwd()
const ts = require(path.join(repo, 'node_modules/typescript'))
const base = '4b049d530a45e296dbbd8afeadd3b5d97ffc97a0'
const git = (...args) => cp.execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
const files = git('diff', '--name-only', base).trim().split('\n').filter(f => /^(app|components|lib|tests)\//.test(f))
assert.deepEqual(files, ['app/page.tsx', 'app/program/ignite/page.tsx', 'app/program/page.tsx'])
const approvedRemoval = `          <p
            style={{
              fontSize: 'var(--landing-body-large)',
              lineHeight: 1.8,
              color: 'rgba(215,199,182,0.9)',
              margin: 0,
              textWrap: 'balance',
            }}
          >
            Your time and attention already have a lot of places to be.
          </p>

`
function parse(file, text) { return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) }
function skeleton(node) {
  if (ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) return [node.kind, '<copy>']
  return [node.kind, ts.isIdentifier(node) || ts.isNumericLiteral(node) || ts.isRegularExpressionLiteral(node) ? node.text : undefined, ...node.getChildren().map(skeleton)]
}
function protectedValues(sf) {
  const result = { numbers: [], paths: [], attributes: [], modules: [], predicates: [], dataCalls: [] }
  function visit(node) {
    if (ts.isNumericLiteral(node)) result.numbers.push(node.text)
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const p = node.parent
      if (/^(?:\/|https?:\/\/|mailto:)/.test(node.text)) result.paths.push(node.text)
      if (ts.isJsxAttribute(p) && /^(?:href|src|className|id|name|type|value|role|data-.+)$/.test(p.name.text)) result.attributes.push([p.name.text, node.text])
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) result.modules.push(node.text)
      if ((ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) || ts.isCaseClause(p)) result.predicates.push(node.text)
      if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && /^(?:from|select|eq|neq|in|rpc|order|filter|contains|match|delete|update|insert|upsert)$/.test(p.expression.name.text)) result.dataCalls.push([p.expression.name.text, node.text])
    }
    ts.forEachChild(node, visit)
  }
  visit(sf); return result
}
const results = files.map(file => {
  const beforeText = git('show', `${base}:${file}`)
  const afterText = fs.readFileSync(path.join(repo, file), 'utf8')
  const before = parse(file, beforeText), after = parse(file, afterText)
  let normalizedText = beforeText
  if (file === 'app/page.tsx') {
    assert.equal(beforeText.split(approvedRemoval).length - 1, 1)
    assert.ok(!afterText.includes('Your time and attention already have a lot of places to be.'))
    normalizedText = beforeText.replace(approvedRemoval, '')
  }
  const normalized = parse(file, normalizedText)
  const originalProtected = protectedValues(before), normalizedProtected = protectedValues(normalized), currentProtected = protectedValues(after)
  const changes = a => Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(currentProtected[k])).map(k => ({ kind: k, before: a[k], after: currentProtected[k] }))
  return { file, rawCopyNeutralAstEqual: JSON.stringify(skeleton(before)) === JSON.stringify(skeleton(after)), approvedPresentationRemoval: file === 'app/page.tsx' ? 'Exactly one redundant introductory paragraph and its own presentational styles; numerical deletions are its lineHeight1.8 and margin0 only.' : null, rawProtectedChanges: changes(originalProtected), normalizedCopyNeutralAstEqual: JSON.stringify(skeleton(normalized)) === JSON.stringify(skeleton(after)), protectedChangesAfterExplicitParagraphRemoval: changes(normalizedProtected) }
})
const report = { comparedWith: base, branch: git('branch', '--show-current').trim(), currentHead: git('rev-parse', 'HEAD').trim(), sourceFiles: files.length, expectedOnlySourceFiles: files, results, qualification: 'Copy-neutral matching alone is not proof. The actual three-file diff was separately reviewed; only text plus one exact redundant p/style removal are authorized. No routes, functional links, handlers, formulae, prices, entitlements, security or legal/clinical source changes.' }
fs.writeFileSync(path.join(__dirname, 'preservation-final.json'), JSON.stringify(report, null, 2) + '\n')
assert.ok(results.every(r => r.normalizedCopyNeutralAstEqual && !r.protectedChangesAfterExplicitParagraphRemoval.length))
console.log(JSON.stringify({ files: files.length, rawAstEqual: results.filter(r => r.rawCopyNeutralAstEqual).length, normalizedAfterExactParagraphRemoval: results.filter(r => r.normalizedCopyNeutralAstEqual).length, protectedChangesAfterNormalization: results.flatMap(r => r.protectedChangesAfterExplicitParagraphRemoval).length }, null, 2))

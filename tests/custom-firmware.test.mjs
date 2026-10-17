import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { transform } from 'esbuild';
const source = readFileSync('src/utils/sodabotFirmwareGenerator.ts', 'utf8').replace(
  /import template from .*?;/, `const template = ${JSON.stringify(readFileSync('firmware/soda-basic-template.ino', 'utf8'))};`);
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { generateCustomFirmwareSet, customFunctionRevision } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const entries = [1, 2, 3].map(i => ({name: `Feature ${i}`, targetSlot: `CUSTOM_${i}`,
  globals: `int slotValue${i} = ${i};`, setup: `slotValue${i} += 1;`,
  functionCode: `void runFeature${i}() {\n  Serial.println(slotValue${i});\n}` }));
test('all three slots keep globals, setup and callable wrappers in one firmware', () => {
  const result = generateCustomFirmwareSet(entries, 'TEST', 'test', 'test', 'test');
  for (let i = 1; i <= 3; i++) {
    assert.ok(result.mergedCode.includes(`int slotValue${i} = ${i};`));
    assert.ok(result.mergedCode.includes(`slotValue${i} += 1;`));
    assert.ok(result.mergedCode.includes(`void customFunction${i}() {\n  runFeature${i}();\n}`));
    assert.equal((result.mergedCode.match(new RegExp(`void customFunction${i}\\(\\)`, 'g')) || []).length, 1);
    assert.ok(result.mergedCode.includes(customFunctionRevision(entries[i - 1])));
  }
  mkdirSync('/tmp/soda_custom_check', {recursive: true});
  writeFileSync('/tmp/soda_custom_check/soda_custom_check.ino', result.mergedCode);
});
test('explicit slot definition retains user code instead of removing it', () => {
  const entry = { name: 'Explicit', targetSlot: 'CUSTOM_1', functionCode: 'void customFunction1() {\n  Serial.println("KEEP_USER_BODY");\n}' };
  const result = generateCustomFirmwareSet([entry]);
  assert.ok(result.mergedCode.includes('KEEP_USER_BODY'));
  assert.equal((result.mergedCode.match(/void customFunction1\(\)/g) || []).length, 1);
});
test('editing one slot changes its revision and keeps other slots', () => {
  const edited = {...entries[1], functionCode: 'void runFeature2() {\n  Serial.println("EDITED");\n}'};
  const result = generateCustomFirmwareSet([entries[0], edited, entries[2]]);
  assert.notEqual(customFunctionRevision(edited), customFunctionRevision(entries[1]));
  assert.ok(result.mergedCode.includes('EDITED'));
  assert.ok(result.mergedCode.includes('runFeature1();'));
  assert.ok(result.mergedCode.includes('runFeature3();'));
});
test('missing source, duplicate functions and duplicate slots fail before export', () => {
  assert.throws(() => generateCustomFirmwareSet([{...entries[0], functionCode: ''}]), /FUNCTION/);
  assert.throws(() => generateCustomFirmwareSet([entries[0], {...entries[1], functionCode: entries[0].functionCode}]), /중복/);
  assert.throws(() => generateCustomFirmwareSet([entries[0], entries[0]]), /중복/);
});

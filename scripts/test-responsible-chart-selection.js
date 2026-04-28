const assert = require('node:assert/strict');
const { getSolidPieChartOption } = require('../miniprogram/utils/chartUtils');

const option = getSolidPieChartOption([
  { name: '物业', value: 10 },
  { name: '业主', value: 4 }
], '责任方');

assert.ok(Array.isArray(option.series), 'responsible pie should expose series array');
assert.equal(option.series.length, 1, 'responsible pie should contain one pie series');

const [series] = option.series;
assert.equal(series.type, 'pie', 'responsible chart should remain a pie series');
assert.equal(series.selectedMode, 'single', 'responsible pie should support single selection');
assert.equal(series.selectedOffset, 12, 'responsible pie should visibly expand selected slice');
assert.equal(series.radius, '86%', 'responsible pie should use the maximum safe radius');

console.log('responsible chart selection config ok');

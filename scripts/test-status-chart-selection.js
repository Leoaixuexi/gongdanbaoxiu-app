const assert = require('node:assert/strict');
const { getRingChartOption } = require('../miniprogram/utils/chartUtils');

const option = getRingChartOption([
  { name: '已提报', value: 12 },
  { name: '维修中', value: 6 }
]);

assert.ok(Array.isArray(option.series), 'ring chart should expose series array');
assert.equal(option.series.length, 1, 'ring chart should contain one pie series');

const [series] = option.series;
assert.equal(series.type, 'pie', 'ring chart should remain a pie series');
assert.equal(series.selectedMode, 'single', 'status pie should support single selection');
assert.equal(series.selectedOffset, 12, 'status pie should visibly expand selected slice');
assert.deepEqual(series.radius, ['48%', '85%'], 'status pie should use a thicker default ring');

console.log('status chart selection config ok');

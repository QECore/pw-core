const { formatActionCall } = require('../../dist/codegen/index');

const action = {
  name: 'assertVisible',
  selector: '#status',
  nth: 0
};

console.log('=== TEST ASSERT VISIBLE ===');
console.log('Result:', formatActionCall('playground', 'why-pw-core', action));

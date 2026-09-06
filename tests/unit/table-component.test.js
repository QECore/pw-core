const test = require('node:test')
const assert = require('node:assert/strict')
const { TableRows } = require('../../dist/component/table')

test('table-component: TableRows get by key and key-value', () => {
  const data = [
    { id: '1', name: 'Alice', role: 'admin' },
    { id: '2', name: 'Bob', role: 'user' },
    { id: '3', name: 'Charlie', role: 'user' }
  ]

  const rows = new TableRows(...data)

  // 1. Get key of first row
  assert.equal(rows.get('name'), 'Alice')
  assert.equal(rows.get('id'), '1')

  // 2. Find row by key-value match
  assert.deepEqual(rows.get('name', 'Bob'), { id: '2', name: 'Bob', role: 'user' })
  assert.equal(rows.get('name', 'NonExistent'), undefined)
})

test('table-component: TableRows getAll by key and key-value', () => {
  const data = [
    { id: '1', name: 'Alice', role: 'admin' },
    { id: '2', name: 'Bob', role: 'user' },
    { id: '3', name: 'Charlie', role: 'user' }
  ]

  const rows = new TableRows(...data)

  // 1. Get array of all values for a column key
  assert.deepEqual(Array.from(rows.getAll('name')), ['Alice', 'Bob', 'Charlie'])

  // 2. Get array of all rows matching key-value pair
  assert.deepEqual(Array.from(rows.getAll('role', 'user')), [
    { id: '2', name: 'Bob', role: 'user' },
    { id: '3', name: 'Charlie', role: 'user' }
  ])
  assert.deepEqual(Array.from(rows.getAll('role', 'admin')), [
    { id: '1', name: 'Alice', role: 'admin' }
  ])
  assert.deepEqual(Array.from(rows.getAll('role', 'guest')), [])
})

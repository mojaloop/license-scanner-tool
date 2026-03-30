'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const { getCsvFiles } = require('../../scripts/_combine_csv_reports')
const fs = require('fs')

Test('getCsvFiles', t => {
  t.test('should filter only .csv files', async t => {
    const stub = Sinon.stub(fs, 'readdir')
    stub.callsFake((dir, cb) => {
      cb(null, ['report1.csv', 'report2.csv', 'summary.xlsx', 'readme.txt'])
    })

    const files = await getCsvFiles('/fake/dir')
    t.deepEqual(files, ['report1.csv', 'report2.csv'], 'returns only csv files')

    stub.restore()
    t.end()
  })

  t.test('should reject on readdir error', async t => {
    const stub = Sinon.stub(fs, 'readdir')
    stub.callsFake((dir, cb) => {
      cb(new Error('ENOENT'))
    })

    try {
      await getCsvFiles('/nonexistent')
      t.fail('should have thrown')
    } catch (err) {
      t.equal(err.message, 'ENOENT', 'rejects with error')
    }

    stub.restore()
    t.end()
  })

  t.test('should return empty array when no csv files', async t => {
    const stub = Sinon.stub(fs, 'readdir')
    stub.callsFake((dir, cb) => {
      cb(null, ['readme.md', 'data.json'])
    })

    const files = await getCsvFiles('/fake/dir')
    t.deepEqual(files, [], 'returns empty array')

    stub.restore()
    t.end()
  })

  t.end()
})

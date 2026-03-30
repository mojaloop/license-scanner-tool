'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const { Readable } = require('stream')
const { getCsvFiles, readAndParseFile } = require('../../scripts/_combine_csv_reports')
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

Test('readAndParseFile', t => {
  t.test('should parse CSV content into rows', async t => {
    const csvContent = 'package,license,github\nbad-pkg,GPL-3.0,https://github.com/bad\n'
    const readable = new Readable({
      encoding: 'utf8',
      read () {
        this.push(csvContent)
        this.push(null)
      }
    })
    readable.setEncoding('utf8')

    const stub = Sinon.stub(fs, 'createReadStream').returns(readable)

    const rows = await readAndParseFile('/fake/file.csv')
    t.ok(Array.isArray(rows), 'returns an array')
    t.equal(rows.length, 2, 'has 2 rows (header + data)')
    t.deepEqual(rows[0], ['package', 'license', 'github'], 'header row parsed')
    t.deepEqual(rows[1], ['bad-pkg', 'GPL-3.0', 'https://github.com/bad'], 'data row parsed')

    stub.restore()
    t.end()
  })

  t.test('should return empty array for empty file', async t => {
    const readable = new Readable({
      read () {
        this.push(null)
      }
    })
    readable.setEncoding('utf8')

    const stub = Sinon.stub(fs, 'createReadStream').returns(readable)

    const rows = await readAndParseFile('/fake/empty.csv')
    t.deepEqual(rows, [], 'returns empty array')

    stub.restore()
    t.end()
  })

  t.end()
})

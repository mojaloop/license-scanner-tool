'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const { Readable } = require('stream')
const { getCsvFiles, readAndParseFile, buildWorkbook } = require('../../scripts/_combine_csv_reports')
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

Test('buildWorkbook', t => {
  t.test('should create workbook with sheets from CSV data', t => {
    const csvFiles = ['project-a.csv', 'project-b.csv']
    const csvRows = [
      [
        ['package', 'license', 'github'],
        ['pkg-a', 'MIT', 'https://github.com/a'],
        ['pkg-b', 'Apache-2.0', 'https://github.com/b']
      ],
      [
        ['package', 'license', 'github'],
        ['pkg-c', 'ISC', 'https://github.com/c']
      ]
    ]

    const workbook = buildWorkbook(csvFiles, csvRows)
    t.equal(workbook.worksheets.length, 2, 'has 2 worksheets')
    t.equal(workbook.worksheets[0].name, 'project-a', 'first sheet named correctly')
    t.equal(workbook.worksheets[1].name, 'project-b', 'second sheet named correctly')

    // Check data is sorted by license column (column 2)
    const ws = workbook.worksheets[0]
    t.equal(ws.getCell(1, 1).value, 'package', 'header row preserved')
    t.equal(ws.getCell(2, 2).value, 'Apache-2.0', 'sorted: Apache-2.0 first')
    t.equal(ws.getCell(3, 2).value, 'MIT', 'sorted: MIT second')
    t.end()
  })

  t.test('should handle empty CSV data', t => {
    const workbook = buildWorkbook([], [])
    t.equal(workbook.worksheets.length, 0, 'no worksheets')
    t.end()
  })

  t.end()
})

'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()

const mockXLSX = {
  utils: {
    encode_cell: ({ c, r }) => {
      const col = String.fromCharCode(65 + c)
      return `${col}${r + 1}`
    },
    decode_range: (ref) => {
      // Simple parser for ranges like "A1:D5"
      const parts = ref.split(':')
      return {
        s: { c: 0, r: 0 },
        e: { c: parts[1].charCodeAt(0) - 65, r: parseInt(parts[1].slice(1)) - 1 }
      }
    },
    encode_range: (range) => {
      const s = String.fromCharCode(65 + range.s.c) + (range.s.r + 1)
      const e = String.fromCharCode(65 + range.e.c) + (range.e.r + 1)
      return `${s}:${e}`
    }
  }
}

const mockFuzz = {
  ratio: Sinon.stub()
}

const mockAllowedList = ['MIT', 'Apache-2.0', 'ISC']
const mockExcludeList = [
  { pkg: 'excluded-pkg@1.0.0', reason: 'Manually reviewed' }
]

const colorModule = proxyquire('../../scripts/_color_and_summarize', {
  'xlsx-style': mockXLSX,
  fuzzball: mockFuzz,
  './Config': { allowedList: mockAllowedList, excludeList: mockExcludeList }
})

Test('fuzzyContains', t => {
  t.test('should return index when fuzzy match found', t => {
    mockFuzz.ratio.returns(0)
    mockFuzz.ratio.withArgs('MIT', 'MIT').returns(100)

    const result = colorModule.fuzzyContains(['Apache-2.0', 'MIT', 'ISC'], 'MIT', 95)
    t.equal(result, 1, 'returns index 1 for MIT')
    t.end()
  })

  t.test('should return -1 when no match found', t => {
    mockFuzz.ratio.returns(0)

    const result = colorModule.fuzzyContains(['MIT', 'ISC'], 'GPL-3.0', 95)
    t.equal(result, -1, 'returns -1')
    t.end()
  })

  t.test('should use default threshold of 95', t => {
    mockFuzz.ratio.returns(96)

    const result = colorModule.fuzzyContains(['MIT'], 'MIT License')
    t.equal(result, 0, 'matches with default threshold')
    t.end()
  })

  t.test('should return first match index and stop', t => {
    mockFuzz.ratio.returns(0)
    mockFuzz.ratio.withArgs('MIT', 'MIT').returns(100)
    mockFuzz.ratio.withArgs('MIT License', 'MIT').returns(98)

    const result = colorModule.fuzzyContains(['Apache', 'MIT', 'MIT License'], 'MIT', 95)
    t.equal(result, 1, 'returns first match')
    t.end()
  })

  t.end()
})

Test('getCellForSheet', t => {
  t.test('should return cell value when cell exists', t => {
    const sheet = {
      A1: { v: 'test-value' }
    }
    const result = colorModule.getCellForSheet(sheet, 0, 0)
    t.equal(result, 'test-value')
    t.end()
  })

  t.test('should return undefined when cell does not exist', t => {
    const sheet = {}
    const result = colorModule.getCellForSheet(sheet, 0, 0)
    t.equal(result, undefined)
    t.end()
  })

  t.end()
})

Test('addToSummaryRows', t => {
  t.test('should create summary rows from error rows', t => {
    const errorRows = [
      {
        row: 1,
        ctx: {
          pkg: 'bad-pkg@1.0.0',
          license: 'GPL-3.0',
          github: 'https://github.com/bad/pkg',
          reason: 'Disallowed license'
        }
      }
    ]

    const rows = colorModule.addToSummaryRows('project-name', errorRows, 'BAD')
    t.equal(rows.length, 1, 'returns 1 row')
    t.equal(rows[0][0], 'project-name', 'first col is sheet name')
    t.equal(rows[0][1], 'bad-pkg@1.0.0', 'second col is package')
    t.equal(rows[0][2], 'GPL-3.0', 'third col is license')
    t.equal(rows[0][5], 'BAD', 'sixth col is message')
    t.end()
  })

  t.test('should return empty array for no error rows', t => {
    const rows = colorModule.addToSummaryRows('project', [], 'BAD')
    t.deepEqual(rows, [], 'returns empty array')
    t.end()
  })

  t.end()
})

Test('addSummaryRowsToSummarySheet', t => {
  t.test('should add rows to sheet and return count', t => {
    const sheet = {}
    const summaryRows = [
      ['proj', 'pkg', 'MIT', 'url', '', 'BAD', 'reason']
    ]
    const style = { font: { bold: true } }

    const count = colorModule.addSummaryRowsToSummarySheet(sheet, summaryRows, style, 0)
    t.equal(count, 1, 'returns row count')
    t.ok(sheet.A2, 'cell A2 exists')
    t.equal(sheet.A2.v, 'proj', 'cell A2 value is correct')
    t.end()
  })

  t.test('should return 0 for empty rows', t => {
    const sheet = {}
    const count = colorModule.addSummaryRowsToSummarySheet(sheet, [], {}, 0)
    t.equal(count, 0)
    t.end()
  })

  t.end()
})

Test('getErrorRows', t => {
  t.test('should identify rows with disallowed licenses', t => {
    mockFuzz.ratio.returns(0) // No fuzzy match = disallowed

    // Single data row, no header (range starts at row 0)
    const sheet = {
      '!ref': 'A1:C1',
      A1: { v: 'bad-pkg' },
      B1: { v: 'GPL-3.0' },
      C1: { v: 'https://github.com/bad' }
    }

    const errors = colorModule.getErrorRows(sheet)
    t.equal(errors.length, 1, 'finds 1 error')
    t.equal(errors[0].row, 0, 'error is on row 0')
    t.equal(errors[0].ctx.license, 'GPL-3.0')
    t.end()
  })

  t.test('should skip rows with allowed licenses', t => {
    mockFuzz.ratio.returns(0)
    mockFuzz.ratio.withArgs('MIT', 'MIT').returns(100)

    const sheet = {
      '!ref': 'A1:B1',
      A1: { v: 'good-pkg' },
      B1: { v: 'MIT' }
    }

    const errors = colorModule.getErrorRows(sheet)
    t.equal(errors.length, 0, 'no errors for allowed license')
    t.end()
  })

  t.test('should skip rows without license string', t => {
    mockFuzz.ratio.returns(0)

    const sheet = {
      '!ref': 'A1:B1',
      A1: { v: 'pkg' }
    }

    const errors = colorModule.getErrorRows(sheet)
    t.equal(errors.length, 0, 'no errors when no license')
    t.end()
  })

  t.test('should skip excluded packages', t => {
    mockFuzz.ratio.returns(0)

    const sheet = {
      '!ref': 'A1:B1',
      A1: { v: 'excluded-pkg@1.0.0' },
      B1: { v: 'GPL-3.0' }
    }

    const errors = colorModule.getErrorRows(sheet)
    t.equal(errors.length, 0, 'excluded package not flagged')
    t.end()
  })

  t.end()
})

Test('getWarningRows', t => {
  t.test('should identify excluded packages as warnings', t => {
    const sheet = {
      '!ref': 'A1:C2',
      A1: { v: 'Package' },
      B1: { v: 'License' },
      C1: { v: 'Github' },
      A2: { v: 'excluded-pkg@1.0.0' },
      B2: { v: 'Custom' },
      C2: { v: 'https://github.com/excluded' }
    }

    const warnings = colorModule.getWarningRows(sheet)
    t.equal(warnings.length, 1, 'finds 1 warning')
    t.equal(warnings[0].ctx.reason, 'Manually reviewed')
    t.end()
  })

  t.test('should return empty array when no excluded packages', t => {
    const sheet = {
      '!ref': 'A1:C2',
      A1: { v: 'Package' },
      A2: { v: 'normal-pkg' }
    }

    const warnings = colorModule.getWarningRows(sheet)
    t.equal(warnings.length, 0)
    t.end()
  })

  t.end()
})

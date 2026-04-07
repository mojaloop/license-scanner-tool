'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()
const ExcelJS = require('exceljs')

const mockFuzz = {
  ratio: Sinon.stub()
}

const mockConst = require('../../scripts/Constants')

const mockAllowedList = ['MIT', 'Apache-2.0', 'ISC']
const mockExcludeList = [
  { pkg: 'excluded-pkg@1.0.0', reason: 'Manually reviewed' }
]

const colorModule = proxyquire('../../scripts/_color_and_summarize', {
  exceljs: ExcelJS,
  fuzzball: mockFuzz,
  './Config': { allowedList: mockAllowedList, excludeList: mockExcludeList }
})

/**
 * Helper: create an ExcelJS worksheet populated with cell data
 * @param {Object} data - keyed by cell reference (e.g. { A1: 'value', B2: 'other' })
 * @returns {ExcelJS.Worksheet}
 */
const createWorksheet = (data) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('test')
  for (const [ref, value] of Object.entries(data)) {
    ws.getCell(ref).value = value
  }
  return ws
}

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
    const ws = createWorksheet({ A1: 'test-value' })
    const result = colorModule.getCellForSheet(ws, 0, 0)
    t.equal(result, 'test-value')
    t.end()
  })

  t.test('should return undefined when cell does not exist', t => {
    const ws = createWorksheet({})
    const result = colorModule.getCellForSheet(ws, 0, 0)
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
    const ws = createWorksheet({})
    const summaryRows = [
      ['proj', 'pkg', 'MIT', 'url', '', 'BAD', 'reason']
    ]
    const style = { font: { bold: true } }

    const count = colorModule.addSummaryRowsToSummarySheet(ws, summaryRows, style, 0)
    t.equal(count, 1, 'returns row count')
    // Row index 0 + 1 = row 1, excel row = 2 (1-indexed)
    t.equal(ws.getCell(2, 1).value, 'proj', 'cell value is correct')
    t.end()
  })

  t.test('should return 0 for empty rows', t => {
    const ws = createWorksheet({})
    const count = colorModule.addSummaryRowsToSummarySheet(ws, [], {}, 0)
    t.equal(count, 0)
    t.end()
  })

  t.end()
})

Test('getErrorRows', t => {
  t.test('should identify rows with disallowed licenses', t => {
    mockFuzz.ratio.returns(0) // No fuzzy match = disallowed

    const ws = createWorksheet({
      A1: 'bad-pkg',
      B1: 'GPL-3.0',
      C1: 'https://github.com/bad'
    })

    const errors = colorModule.getErrorRows(ws)
    t.equal(errors.length, 1, 'finds 1 error')
    t.equal(errors[0].row, 0, 'error is on row 0')
    t.equal(errors[0].ctx.license, 'GPL-3.0')
    t.end()
  })

  t.test('should skip rows with allowed licenses', t => {
    mockFuzz.ratio.returns(0)
    mockFuzz.ratio.withArgs('MIT', 'MIT').returns(100)

    const ws = createWorksheet({
      A1: 'good-pkg',
      B1: 'MIT'
    })

    const errors = colorModule.getErrorRows(ws)
    t.equal(errors.length, 0, 'no errors for allowed license')
    t.end()
  })

  t.test('should skip rows without license string', t => {
    mockFuzz.ratio.returns(0)

    const ws = createWorksheet({
      A1: 'pkg'
    })

    const errors = colorModule.getErrorRows(ws)
    t.equal(errors.length, 0, 'no errors when no license')
    t.end()
  })

  t.test('should skip excluded packages', t => {
    mockFuzz.ratio.returns(0)

    const ws = createWorksheet({
      A1: 'excluded-pkg@1.0.0',
      B1: 'GPL-3.0'
    })

    const errors = colorModule.getErrorRows(ws)
    t.equal(errors.length, 0, 'excluded package not flagged')
    t.end()
  })

  t.end()
})

Test('getWarningRows', t => {
  t.test('should identify excluded packages as warnings', t => {
    const ws = createWorksheet({
      A1: 'Package',
      B1: 'License',
      C1: 'Github',
      A2: 'excluded-pkg@1.0.0',
      B2: 'Custom',
      C2: 'https://github.com/excluded'
    })

    const warnings = colorModule.getWarningRows(ws)
    t.equal(warnings.length, 1, 'finds 1 warning')
    t.equal(warnings[0].ctx.reason, 'Manually reviewed')
    t.end()
  })

  t.test('should return empty array when no excluded packages', t => {
    const ws = createWorksheet({
      A1: 'Package',
      A2: 'normal-pkg'
    })

    const warnings = colorModule.getWarningRows(ws)
    t.equal(warnings.length, 0)
    t.end()
  })

  t.test('should skip rows without package string', t => {
    const ws = createWorksheet({
      B1: 'MIT'
    })

    const warnings = colorModule.getWarningRows(ws)
    t.equal(warnings.length, 0, 'skips rows without package')
    t.end()
  })

  t.end()
})

Test('addErrorsToSheet', t => {
  t.test('should add error styling and reason column to sheet', t => {
    const ws = createWorksheet({
      A1: 'Package',
      B1: 'License',
      C1: 'Github',
      A2: 'bad-pkg',
      B2: 'GPL-3.0',
      C2: 'https://github.com/bad'
    })

    const errorRows = [{
      row: 1,
      ctx: { reason: 'Disallowed license', license: 'GPL-3.0', pkg: 'bad-pkg' }
    }]

    colorModule.addErrorsToSheet(ws, errorRows)

    // Reason header added at column D row 1
    t.equal(ws.getCell(1, 4).value, 'reason', 'reason header value')

    // Error reason added at column D row 2
    t.equal(ws.getCell(2, 4).value, 'Disallowed license', 'error reason value')
    t.deepEqual(ws.getCell(2, 4).font, mockConst.cellStyleError.font, 'error reason has error font')
    t.deepEqual(ws.getCell(2, 4).fill, mockConst.cellStyleError.fill, 'error reason has error fill')

    // Existing cells should have error styling
    t.deepEqual(ws.getCell(2, 1).font, mockConst.cellStyleError.font, 'row cells get error font')
    t.deepEqual(ws.getCell(2, 2).font, mockConst.cellStyleError.font, 'license cell gets error font')
    t.end()
  })

  t.test('should skip null cells when applying styles', t => {
    // Create worksheet with a gap: A1 has value, B1 empty, C1 has value
    const ws = createWorksheet({
      A1: 'pkg',
      C1: 'https://github.com/pkg'
    })

    const errorRows = [{
      row: 0,
      ctx: { reason: 'Bad' }
    }]

    colorModule.addErrorsToSheet(ws, errorRows)
    t.notOk(ws.getCell(1, 2).value, 'null cell remains empty')
    t.deepEqual(ws.getCell(1, 1).font, mockConst.cellStyleError.font, 'populated cell gets style')
    t.deepEqual(ws.getCell(1, 3).font, mockConst.cellStyleError.font, 'other populated cell gets style')
    t.end()
  })

  t.test('should handle empty error rows', t => {
    const ws = createWorksheet({
      A1: 'pkg'
    })

    colorModule.addErrorsToSheet(ws, [])
    t.equal(ws.getCell(1, 4).value, 'reason', 'reason header still added')
    t.end()
  })

  t.end()
})

Test('addWarningsToSheet', t => {
  t.test('should add warning styling and reason column to sheet', t => {
    const ws = createWorksheet({
      A1: 'Package',
      B1: 'License',
      C1: 'Github',
      A2: 'warned-pkg',
      B2: 'Custom-1.0',
      C2: 'https://github.com/warned'
    })

    const warningRows = [{
      row: 1,
      ctx: { reason: 'Manually reviewed', pkg: 'warned-pkg' }
    }]

    colorModule.addWarningsToSheet(ws, warningRows)

    // Warning reason added at column D row 2
    t.equal(ws.getCell(2, 4).value, 'Manually reviewed', 'warning reason value')
    t.deepEqual(ws.getCell(2, 4).font, mockConst.cellStyleWarning.font, 'warning reason has warning font')
    t.deepEqual(ws.getCell(2, 4).fill, mockConst.cellStyleWarning.fill, 'warning reason has warning fill')

    // Existing cells should have warning styling
    t.deepEqual(ws.getCell(2, 1).font, mockConst.cellStyleWarning.font, 'row cells get warning font')
    t.end()
  })

  t.test('should skip null cells when applying warning styles', t => {
    // Create worksheet with a gap: A1 has value, B1 empty, C1 has value
    const ws = createWorksheet({
      A1: 'pkg',
      C1: 'https://github.com/pkg'
    })

    const warningRows = [{
      row: 0,
      ctx: { reason: 'Reviewed' }
    }]

    colorModule.addWarningsToSheet(ws, warningRows)
    t.notOk(ws.getCell(1, 2).value, 'null cell remains empty')
    t.deepEqual(ws.getCell(1, 1).font, mockConst.cellStyleWarning.font, 'populated cell gets style')
    t.end()
  })

  t.test('should handle empty warning rows', t => {
    const ws = createWorksheet({
      A1: 'pkg'
    })

    colorModule.addWarningsToSheet(ws, [])
    t.notOk(ws.getCell(1, 4).value, 'no warning cells added')
    t.end()
  })

  t.end()
})

Test('applyStyleToCell', t => {
  t.test('should apply font and fill styles', t => {
    const ws = createWorksheet({ A1: 'test' })
    const cell = ws.getCell('A1')

    colorModule.applyStyleToCell(cell, mockConst.cellStyleError)
    t.deepEqual(cell.font, mockConst.cellStyleError.font, 'font applied')
    t.deepEqual(cell.fill, mockConst.cellStyleError.fill, 'fill applied')
    t.end()
  })

  t.test('should handle style with only font', t => {
    const ws = createWorksheet({ A1: 'test' })
    const cell = ws.getCell('A1')

    colorModule.applyStyleToCell(cell, mockConst.cellStyleBold)
    t.deepEqual(cell.font, mockConst.cellStyleBold.font, 'font applied')
    t.end()
  })

  t.test('should handle empty style', t => {
    const ws = createWorksheet({ A1: 'test' })
    const cell = ws.getCell('A1')

    colorModule.applyStyleToCell(cell, {})
    t.equal(cell.value, 'test', 'value unchanged')
    t.end()
  })

  t.end()
})

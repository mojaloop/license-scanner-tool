'use strict'

/**
 * Integration test for the full CSV -> xlsx -> color/summarize pipeline.
 *
 * This test exercises the ExcelJS <-> jszip interaction end-to-end by
 * writing and reading real .xlsx files on disk. It was added as a
 * regression test for mojaloop/project#4376 where the old xlsx-style
 * library broke when jszip was upgraded to 3.10.1.
 *
 * What it validates:
 * - buildWorkbook() creates a valid xlsx that can be written to disk
 * - The written xlsx is a valid ZIP file (xlsx is ZIP-based)
 * - The xlsx can be read back from disk by ExcelJS
 * - getErrorRows/getWarningRows correctly identify license issues
 * - addErrorsToSheet/addWarningsToSheet apply styling without errors
 * - addSummaryRowsToSummarySheet writes summary data
 * - The final enhanced xlsx can be written and re-read successfully
 * - Cell values and styling survive the full write/read cycle
 */

const Test = require('tape')
const fs = require('fs')
const path = require('path')
const os = require('os')
const ExcelJS = require('exceljs')

const { buildWorkbook } = require('../../scripts/_combine_csv_reports')
const Constants = require('../../scripts/Constants')

// Use proxyquire to inject test config into _color_and_summarize
const proxyquire = require('proxyquire').noCallThru()

const testAllowedList = ['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause']
const testExcludeList = [
  { pkg: 'manually-reviewed-pkg@2.0.0', reason: 'Reviewed by legal team' }
]

const colorModule = proxyquire('../../scripts/_color_and_summarize', {
  './Config': { allowedList: testAllowedList, excludeList: testExcludeList }
})

// Helper: create a temp directory for test artifacts
const createTempDir = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'license-scanner-test-'))
}

// Sample CSV data simulating license-checker output
const sampleCsvFiles = ['project-alpha.csv', 'project-beta.csv']
const sampleCsvRows = [
  [
    ['package', 'license', 'repository'],
    ['express@4.18.0', 'MIT', 'https://github.com/expressjs/express'],
    ['lodash@4.17.21', 'MIT', 'https://github.com/lodash/lodash'],
    ['some-gpl-pkg@1.0.0', 'GPL-3.0', 'https://github.com/example/gpl-pkg'],
    ['manually-reviewed-pkg@2.0.0', 'CUSTOM-1.0', 'https://github.com/example/custom']
  ],
  [
    ['package', 'license', 'repository'],
    ['axios@1.6.0', 'MIT', 'https://github.com/axios/axios'],
    ['another-bad-pkg@0.1.0', 'AGPL-3.0', 'https://github.com/example/agpl']
  ]
]

Test('Integration: full xlsx pipeline (regression test for #4376)', t => {
  let tempDir

  t.test('setup: create temp directory', t => {
    tempDir = createTempDir()
    t.ok(fs.existsSync(tempDir), 'temp directory created')
    t.end()
  })

  t.test('step 1: buildWorkbook creates valid xlsx from CSV data', async t => {
    const workbook = buildWorkbook(sampleCsvFiles, sampleCsvRows)

    t.equal(workbook.worksheets.length, 2, 'workbook has 2 sheets')
    t.equal(workbook.worksheets[0].name, 'project-alpha', 'sheet 1 named correctly')
    t.equal(workbook.worksheets[1].name, 'project-beta', 'sheet 2 named correctly')

    // Write to disk — this exercises ExcelJS -> jszip serialization
    const xlsxPath = path.join(tempDir, 'license-summary.xlsx')
    await workbook.xlsx.writeFile(xlsxPath)

    t.ok(fs.existsSync(xlsxPath), 'xlsx file written to disk')

    // Verify it's a valid ZIP (xlsx is ZIP-based, starts with PK magic bytes)
    const fileBuffer = fs.readFileSync(xlsxPath)
    t.ok(fileBuffer.length > 100, 'xlsx file has content')
    t.equal(fileBuffer[0], 0x50, 'starts with P (ZIP magic byte 1)')
    t.equal(fileBuffer[1], 0x4B, 'starts with K (ZIP magic byte 2)')

    t.end()
  })

  t.test('step 2: xlsx can be read back from disk', async t => {
    const xlsxPath = path.join(tempDir, 'license-summary.xlsx')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(xlsxPath)

    t.equal(workbook.worksheets.length, 2, 'read back 2 sheets')

    const ws = workbook.worksheets[0]
    t.ok(ws.rowCount >= 4, 'sheet has header + data rows')
    t.equal(ws.getCell(1, 1).value, 'package', 'header preserved after write/read cycle')
    t.end()
  })

  t.test('step 3: getErrorRows identifies disallowed licenses', async t => {
    const xlsxPath = path.join(tempDir, 'license-summary.xlsx')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(xlsxPath)

    const ws1 = workbook.worksheets[0] // project-alpha
    const errors1 = colorModule.getErrorRows(ws1)
    // Header row "license" also gets flagged (not in allowedList) + GPL-3.0
    // manually-reviewed-pkg is in excludeList so it's skipped
    t.ok(errors1.length >= 1, 'project-alpha has errors')
    const gplError = errors1.find(e => e.ctx.license === 'GPL-3.0')
    t.ok(gplError, 'error identifies GPL-3.0')
    t.ok(gplError.ctx.pkg.includes('some-gpl-pkg'), 'error identifies correct package')

    const ws2 = workbook.worksheets[1] // project-beta
    const errors2 = colorModule.getErrorRows(ws2)
    const agplError = errors2.find(e => e.ctx.license === 'AGPL-3.0')
    t.ok(agplError, 'project-beta has AGPL-3.0 error')

    t.end()
  })

  t.test('step 4: getWarningRows identifies excluded packages', async t => {
    const xlsxPath = path.join(tempDir, 'license-summary.xlsx')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(xlsxPath)

    const ws1 = workbook.worksheets[0]
    const warnings = colorModule.getWarningRows(ws1)
    t.equal(warnings.length, 1, 'finds 1 warning (manually reviewed package)')
    t.equal(warnings[0].ctx.reason, 'Reviewed by legal team', 'warning has correct reason')

    t.end()
  })

  t.test('step 5: addErrorsToSheet and addWarningsToSheet apply styling', async t => {
    const xlsxPath = path.join(tempDir, 'license-summary.xlsx')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(xlsxPath)

    workbook.eachSheet((ws) => {
      const errorRows = colorModule.getErrorRows(ws)
      const warningRows = colorModule.getWarningRows(ws)
      colorModule.addErrorsToSheet(ws, errorRows)
      colorModule.addWarningsToSheet(ws, warningRows)
    })

    // Verify styling was applied to project-alpha sheet
    const ws = workbook.worksheets[0]

    // Reason column (column 4) should have content — either "reason" header
    // or an error reason if the header row was also flagged
    t.ok(ws.getCell(1, 4).value, 'reason column has content in row 1')

    // Find the GPL row and check it has error styling
    let gplRow = null
    ws.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        if (cell.value === 'GPL-3.0') gplRow = rowNumber
      })
    })
    t.ok(gplRow, 'found GPL-3.0 row')

    const gplReasonCell = ws.getCell(gplRow, 4)
    t.equal(gplReasonCell.value, 'Disallowed license', 'error reason set')
    t.ok(gplReasonCell.font, 'error cell has font styling')
    t.ok(gplReasonCell.fill, 'error cell has fill styling')

    // Write the styled workbook back — tests write after styling
    const styledPath = path.join(tempDir, 'license-summary-styled.xlsx')
    await workbook.xlsx.writeFile(styledPath)
    t.ok(fs.existsSync(styledPath), 'styled xlsx written to disk')

    t.end()
  })

  t.test('step 6: summary sheet creation works end-to-end', async t => {
    const xlsxPath = path.join(tempDir, 'license-summary.xlsx')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(xlsxPath)

    // Create output workbook with summary sheet first (mirrors main() logic)
    const outputWorkbook = new ExcelJS.Workbook()
    const summarySheet = outputWorkbook.addWorksheet('summary')
    summarySheet.columns = [
      { width: 20 }, { width: 20 }, { width: 16 },
      { width: 45 }, { width: 2 }, { width: 15 }, { width: 55 }
    ]

    const headerCell = summarySheet.getCell(1, 1)
    headerCell.value = 'License Summary'
    colorModule.applyStyleToCell(headerCell, Constants.cellStyleBold)

    const headers = ['Project', 'Package', 'License', 'Github', '', 'Severity', 'Notes']
    headers.forEach((h, i) => {
      const cell = summarySheet.getCell(4, i + 1)
      cell.value = h
      colorModule.applyStyleToCell(cell, Constants.cellStyleBold)
    })

    let summaryRowIdx = 5

    workbook.eachSheet((ws) => {
      const errorRows = colorModule.getErrorRows(ws)
      const warningRows = colorModule.getWarningRows(ws)
      colorModule.addErrorsToSheet(ws, errorRows)
      colorModule.addWarningsToSheet(ws, warningRows)

      const errorSummaryRows = colorModule.addToSummaryRows(ws.name, errorRows, 'BAD')
      summaryRowIdx += colorModule.addSummaryRowsToSummarySheet(
        summarySheet, errorSummaryRows, Constants.cellStyleError, summaryRowIdx
      )

      const warnSummaryRows = colorModule.addToSummaryRows(ws.name, warningRows, 'WARN')
      summaryRowIdx += colorModule.addSummaryRowsToSummarySheet(
        summarySheet, warnSummaryRows, Constants.cellStyleWarning, summaryRowIdx
      )

      // Copy sheet to output workbook
      const outSheet = outputWorkbook.addWorksheet(ws.name)
      ws.columns.forEach((col, idx) => {
        if (col && col.width) {
          outSheet.getColumn(idx + 1).width = col.width
        }
      })
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const newRow = outSheet.getRow(rowNumber)
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const newCell = newRow.getCell(colNumber)
          newCell.value = cell.value
          if (cell.font) newCell.font = cell.font
          if (cell.fill && cell.fill.type) newCell.fill = cell.fill
        })
      })
    })

    // Write the final output
    const finalPath = path.join(tempDir, 'license-summary-final.xlsx')
    await outputWorkbook.xlsx.writeFile(finalPath)
    t.ok(fs.existsSync(finalPath), 'final xlsx written')

    // Read back and validate
    const finalWorkbook = new ExcelJS.Workbook()
    await finalWorkbook.xlsx.readFile(finalPath)

    t.equal(finalWorkbook.worksheets.length, 3, 'final has 3 sheets (summary + 2 projects)')
    t.equal(finalWorkbook.worksheets[0].name, 'summary', 'summary sheet is first')
    t.equal(finalWorkbook.worksheets[1].name, 'project-alpha', 'project-alpha is second')
    t.equal(finalWorkbook.worksheets[2].name, 'project-beta', 'project-beta is third')

    // Verify summary content
    const summary = finalWorkbook.worksheets[0]
    t.equal(summary.getCell(1, 1).value, 'License Summary', 'summary header present')
    t.equal(summary.getCell(4, 1).value, 'Project', 'summary column headers present')

    // Verify summary has error and warning entries
    let hasErrorEntry = false
    let hasWarningEntry = false
    summary.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value === 'BAD') hasErrorEntry = true
        if (cell.value === 'WARN') hasWarningEntry = true
      })
    })
    t.ok(hasErrorEntry, 'summary contains error entries')
    t.ok(hasWarningEntry, 'summary contains warning entries')

    // Verify data sheets have reason column content
    const alphaSheet = finalWorkbook.worksheets[1]
    t.ok(alphaSheet.getCell(1, 4).value, 'reason column copied to output')

    t.end()
  })

  t.test('step 7: verify xlsx survives multiple write/read cycles', async t => {
    // This specifically tests ExcelJS <-> jszip serialization stability
    const cyclePath = path.join(tempDir, 'cycle-test.xlsx')

    // Cycle 1: Create and write
    const wb1 = new ExcelJS.Workbook()
    const ws1 = wb1.addWorksheet('test')
    ws1.getCell('A1').value = 'package'
    ws1.getCell('B1').value = 'license'
    ws1.getCell('A2').value = 'test-pkg@1.0.0'
    ws1.getCell('B2').value = 'MIT'
    ws1.getCell('B2').font = Constants.cellStyleError.font
    ws1.getCell('B2').fill = Constants.cellStyleError.fill
    await wb1.xlsx.writeFile(cyclePath)

    // Cycle 2: Read, modify, write
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.readFile(cyclePath)
    const ws2 = wb2.worksheets[0]
    ws2.getCell('C1').value = 'status'
    ws2.getCell('C2').value = 'flagged'
    ws2.getCell('C2').font = Constants.cellStyleWarning.font
    ws2.getCell('C2').fill = Constants.cellStyleWarning.fill
    await wb2.xlsx.writeFile(cyclePath)

    // Cycle 3: Read and verify everything survived
    const wb3 = new ExcelJS.Workbook()
    await wb3.xlsx.readFile(cyclePath)
    const ws3 = wb3.worksheets[0]

    t.equal(ws3.getCell('A1').value, 'package', 'original data survives cycles')
    t.equal(ws3.getCell('B2').value, 'MIT', 'original cell value preserved')
    t.equal(ws3.getCell('C2').value, 'flagged', 'added data preserved')

    // Verify styling survived the cycle
    t.ok(ws3.getCell('B2').font, 'error font styling survives read/write cycle')
    t.ok(ws3.getCell('B2').fill, 'error fill styling survives read/write cycle')
    t.ok(ws3.getCell('C2').font, 'warning font styling survives read/write cycle')
    t.ok(ws3.getCell('C2').fill, 'warning fill styling survives read/write cycle')

    t.end()
  })

  t.test('cleanup: remove temp directory', t => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    t.notOk(fs.existsSync(tempDir), 'temp directory removed')
    t.end()
  })

  t.end()
})

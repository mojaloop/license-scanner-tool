'use strict'

const Test = require('tape')
const path = require('path')
const Constants = require('../../scripts/Constants')

Test('Constants exports', t => {
  t.test('xlsxFile should be a valid path string', t => {
    t.ok(typeof Constants.xlsxFile === 'string', 'xlsxFile is a string')
    t.ok(Constants.xlsxFile.endsWith(path.join('results', 'license-summary.xlsx')), 'xlsxFile ends with correct path')
    t.end()
  })

  t.test('column indexes should be numbers', t => {
    t.equal(Constants.COLUMN_PACKAGE, 0, 'COLUMN_PACKAGE is 0')
    t.equal(Constants.COLUMN_LICENSE, 1, 'COLUMN_LICENSE is 1')
    t.equal(Constants.COLUMN_GITHUB, 2, 'COLUMN_GITHUB is 2')
    t.equal(Constants.COLUMN_ERROR_MESSAGE, 3, 'COLUMN_ERROR_MESSAGE is 3')
    t.end()
  })

  t.test('LICENSE_STRING_MATCH_THRESHOLD should be a number', t => {
    t.equal(typeof Constants.LICENSE_STRING_MATCH_THRESHOLD, 'number')
    t.equal(Constants.LICENSE_STRING_MATCH_THRESHOLD, 75)
    t.end()
  })

  t.test('cell styles should have correct structure', t => {
    t.ok(Constants.cellStyleError.font, 'cellStyleError has font')
    t.ok(Constants.cellStyleError.font.color, 'cellStyleError has font.color')
    t.ok(Constants.cellStyleError.fill, 'cellStyleError has fill')

    t.ok(Constants.cellStyleWarning.font, 'cellStyleWarning has font')
    t.ok(Constants.cellStyleWarning.fill, 'cellStyleWarning has fill')

    t.ok(Constants.cellStyleBold.font, 'cellStyleBold has font')
    t.equal(Constants.cellStyleBold.font.bold, true, 'cellStyleBold is bold')
    t.end()
  })

  t.end()
})

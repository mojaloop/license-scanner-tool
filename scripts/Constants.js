const path = require('path')

const xlsxFile = path.join(__dirname, '..', 'results', 'license-summary.xlsx')

/* Constants */
const COLUMN_PACKAGE = 0
const COLUMN_LICENSE = 1
const COLUMN_GITHUB = 2
const COLUMN_ERROR_MESSAGE = 3

const LICENSE_STRING_MATCH_THRESHOLD = 75

const cellStyleError = {
  font: {
    color: { argb: 'FF9C0007' }
  },
  fill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFC7CE' }
  }
}

const cellStyleWarning = {
  font: {
    color: { argb: 'FF9C5700' }
  },
  fill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFEB9B' }
  }
}

const cellStyleBold = {
  font: {
    bold: true
  }
}

module.exports = {
  xlsxFile,
  COLUMN_PACKAGE,
  COLUMN_LICENSE,
  COLUMN_GITHUB,
  COLUMN_ERROR_MESSAGE,
  LICENSE_STRING_MATCH_THRESHOLD,
  cellStyleError,
  cellStyleWarning,
  cellStyleBold
}

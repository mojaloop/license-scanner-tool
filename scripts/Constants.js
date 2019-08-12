const xlsxFile = `${__dirname}/../results/license-summary.xlsx`

/* Constants */
const COLUMN_PACKAGE = 0
const COLUMN_LICENSE = 1
const COLUMN_GITHUB = 2
const COLUMN_ERROR_MESSAGE = 3

const LICENSE_STRING_MATCH_THRESHOLD = 75

const cellStyleError = {
  font: {
    color: { rgb: "9C0007" }
  },
  fill: {
    fgColor: { rgb: "FFC7CE" }
  }
}

const cellStyleWarning = {
  font: {
    color: { rgb: "9C5700" }
  },
  fill: {
    fgColor: { rgb: "FFEB9B" }
  }
}

const cellStyleBold = {
  font: {
    bold: true
  },
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
  cellStyleBold,
}
#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source .env
LIB_DIR=${DIR}/lib
eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${DIR}/config.toml)

cd ${DIR}/checked_out
mkdir -p ${DIR}/results


function runScannerTool() {
  #insert switch based on the env
  case ${tool} in
  fossa-api)
    runFossaApi $1
    ;;
  fossa-json)
    runFossaJSON $1
    ;;
  csv)
    runCSV $1
    ;;
  *)
    echo "unsupported tool: ${tool}"
    echo "check your config.toml and try again."
    ;;
  esac
}

function runFossaApi() {
  REPO_PATH=$1
  echo "Running fossa-api for repo: ${REPO_PATH}"

  cd ${DIR}/checked_out/${REPO_PATH}
  fossa analyze 
}

function runFossaJSON() {
  REPO_PATH=$1
  echo "Running fossa-json for repo: ${REPO_PATH}"

  cd ${DIR}/checked_out/${REPO_PATH}
  fossa analyze -o > ${DIR}/results/${REPO_PATH}.json
}

function runCSV() {
  echo 'csv not yet implemented'
  exit 1
}


for OUTPUT in $(cat ${DIR}/repos | grep "^[^#;]")
do
  REPO_PATH=`echo ${OUTPUT} | awk -F 'mojaloop/' '{print $2}'`

  runScannerTool ${REPO_PATH}
done

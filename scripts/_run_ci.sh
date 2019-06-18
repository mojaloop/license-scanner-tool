#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR=${DIR}/..
LIB_DIR=${ROOT_DIR}/lib

source .env
eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${ROOT_DIR}/config.toml)


if [ ! -d "${pathToRepo}" ]; then 
  echo "cannot find pathToRepo: ${pathToRepo}. Please check and try again"
  exit 1
fi

mkdir -p ${ROOT_DIR}/results


#replace whitespace with ; for the license-checker tool
excludeList=`echo ${excludeList} | awk '{gsub(/[ \t]/,";");print}'`
failList=`echo ${failList} | awk '{gsub(/[ \t]/,";");print}'`

echo "Excluding the following packages: ${excludeList}"
echo "Failing on the following licenses: ${failList}"

function listLicenses() {
  cd ${pathToRepo}
  license-checker . \
    --excludePackages ${excludeList} \
    --production --csv > ${ROOT_DIR}/results/licenses.csv
}

function checkLicenses() {
  cd ${pathToRepo}
  license-checker . \
    --excludePackages ${excludeList} \
    --failOn ${failList} \
    --production --csv
}

listLicenses
checkLicenses
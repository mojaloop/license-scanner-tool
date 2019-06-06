#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source .env
export CFLAGS=-I/usr/local/opt/openssl/include
export LDFLAGS=-L/usr/local/opt/openssl/lib

mkdir -p ${DIR}/checked_out
mkdir -p ${DIR}/results
cd ${DIR}/checked_out

function runFossa() {

  REPO_PATH=$1
  echo "Running Fossa for repo: ${REPO_PATH}"

  cd ${DIR}/checked_out/${REPO_PATH}
  fossa analyze -o > ${DIR}/results/${REPO_PATH}.json
}


for OUTPUT in $(cat ${DIR}/repos | grep "^[^#;]")
do
  REPO_PATH=`echo ${OUTPUT} | awk -F 'mojaloop/' '{print $2}'`
  runFossa ${REPO_PATH}
done

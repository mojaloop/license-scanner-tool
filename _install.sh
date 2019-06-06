#!/usr/bin/env bash

###
# _run_all.sh 
#
# iterates through a list of repos in ./repos, checks them out
# and runs fossa on each. 
#
# Use this script to quickly and easily build out a report for all repos
#


DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source .env
export CFLAGS=-I/usr/local/opt/openssl/include
export LDFLAGS=-L/usr/local/opt/openssl/lib

mkdir -p ${DIR}/checked_out
cd ${DIR}/checked_out

function setUp() {
  REPO_PATH=$1
  echo "Setting up repo ${REPO_PATH}"
  cd ${DIR}/checked_out/${REPO_PATH}

  # TODO: handle other non-npm cases
  npm install
  fossa init
}

for OUTPUT in $(cat ${DIR}/repos | grep "^[^#;]")
do
  REPO_PATH=`echo ${OUTPUT} | awk -F 'mojaloop/' '{print $2}'`
  setUp ${REPO_PATH}
done

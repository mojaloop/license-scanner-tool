#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR=${DIR}/..
LIB_DIR=${ROOT_DIR}/lib

export CFLAGS=-I/usr/local/opt/openssl/include
export LDFLAGS=-L/usr/local/opt/openssl/lib
source .env
eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${ROOT_DIR}/config.toml)

if [ ${mode} == "ci" ]; then
  echo 'ci mode specified. Skipping install'
  exit 0
fi

mkdir -p ${ROOT_DIR}/checked_out
cd ${ROOT_DIR}/checked_out

function setUp() {
  REPO_PATH=$1
  echo "Setting up repo ${REPO_PATH}"
  cd ${ROOT_DIR}/checked_out/${REPO_PATH}

  stat package.json > /dev/null 2>&1 && npm install || echo 'not a node project'
  fossa init
}

for OUTPUT in ${repos}
do
  REPO_PATH=`echo ${OUTPUT} | awk -F 'mojaloop/' '{print $2}'`
  setUp ${REPO_PATH}
done

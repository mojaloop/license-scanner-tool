#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR=${DIR}/..
LIB_DIR=${ROOT_DIR}/lib

##
# Set up the environment: 
# 1. the common .env
# 2. env from config.toml
# 3. Any env overrides found`
##
source .env
eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${ROOT_DIR}/config.toml)
source .env_override

case ${mode} in
  docker)
    ${DIR}/_run_docker.sh
    ;;
  local)
    ${DIR}/_run_local.sh
    ;;
  standalone)
    ${DIR}/_run_standalone.sh
    ;;
  *)
    echo "unsupported mode: ${mode}"
    echo "check your config.toml and try again."
    ;;
esac
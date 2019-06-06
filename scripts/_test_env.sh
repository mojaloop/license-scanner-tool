#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR=${DIR}/..
LIB_DIR=${ROOT_DIR}/lib


eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${ROOT_DIR}/config.toml)
env

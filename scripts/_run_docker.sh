#!/usr/bin/env bash

##
# _run_docker allows you to run the license scan against node_modules in a docker image
# for now, it simply runs the docker image, copies the node_modules out, and then runs
# _run_local tool
##

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR=${DIR}/..
LIB_DIR=${ROOT_DIR}/lib
source ${DIR}/colors.sh


##
# Set up the environment: 
# 1. the common .env
# 2. env from config.toml
# 3. Any env overrides found
##
source .env
eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${ROOT_DIR}/config.toml)
source .env_override

# Ensure backwards compatibility with deprecated `dockerImage` variable
if [ -z "${dockerImages}${dockerImage}" ]; then
  logErr "'dockerImages' env var not found in docker mode. Please check the config and try again."
  exit 1
fi

if [ ! -z ${dockerImage} ] && [ ! -z "$dockerImages" ]; then
  logWarn "Both 'dockerImage' and 'dockerImages' found. Ignoring deprecated 'dockerImage' setting."
fi

if [ ! -z "$dockerImage" ] && [ -z "$dockerImages" ]; then
  logWarn "Deprecated 'dockerImage' var found."
  dockerImages=${dockerImage}
fi


excludeList=`echo ${excludeList} | awk '{MAX=split($0,a,";"); for (x=1; x <= MAX; x = x + 2) {printf a[x]; printf ";";}}'`
echo "Excluding the following packages: ${excludeList}"
echo "Failing on the following licenses: ${failList}"

function listLicenses() {
  containerName=$1
  nodeDirectory=$2
  cd ${nodeDirectory}

  ${LIB_DIR}/node_modules/.bin/license-checker . \
    --production --csv > ${ROOT_DIR}/results/${containerName}.csv
}

function checkLicenses() {
  containerName=$1
  nodeDirectory=$2
  cd ${nodeDirectory}

  ${LIB_DIR}/node_modules/.bin/license-checker  . \
    --excludePackages ${excludeList} \
    --failOn ${failList} \
    --production --csv
}

function processDockerImage() {
  stepDockerImage=$@
  logStep "Processing docker image: ${stepDockerImage}"
  containerName=$(echo ${stepDockerImage} | awk -F"/|:" '{print $2}')

  mkdir -p /tmp/$containerName/node_modules

  docker rm -f $containerName  > /dev/null 2>&1 || logSubStep 'Container already stopped'
  docker pull $stepDockerImage

  logSubStep "Creating $containerName from $stepDockerImage"

  # create a non-running container
  docker create --name $containerName $stepDockerImage

  # copy out node_modules
  # Hacky workaround for inconsistent naming of mojaloop simulator: TODO: remote this once ticket is closed
  # Open Ticket: https://github.com/mojaloop/project/issues/929
  if [ "$containerName" == "simulator" ]; then
    logWarn "mojaloop/simulator file path is inconsistent - using temporary hacky workaround to get node_modules"
    docker cp $containerName:/opt/simulators/node_modules /tmp/$containerName/node_modules
  else 
    docker cp $containerName:/opt/$containerName/node_modules /tmp/$containerName/node_modules
  fi

  # run the license scan
  listLicenses ${containerName} /tmp/$containerName/node_modules
  checkLicenses ${containerName} /tmp/$containerName/node_modules
  result=$?

  #cleanup
  rm -rf /tmp/$containerName/node_modules
  docker rm -f $containerName

  if [ ${result} -ne 0 ]; then
    logErr "_run_docker failed on image: ${stepDockerImage}"
    exit ${result}
  fi
}

# change delimiter from `;` to ` ` to allow for simple iteration
dockerImages=`echo ${dockerImages} | awk '{gsub(/[;]/," ");print}'`

# iterate through docker images
for OUTPUT in ${dockerImages}
do
  processDockerImage ${OUTPUT}
done

exit 0

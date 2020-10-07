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
echo "Allowing only the following licenses: ${allowedList}"

function listLicenses() {
  containerName=$1
  nodeDirectory=$2
  cd ${nodeDirectory}

  ${LIB_DIR}/node_modules/.bin/license-checker . \
    --production --csv > ${ROOT_DIR}/results/${containerName}.csv
}

function checkLicenses() {
  output=/tmp/license_output

  containerName=$1
  nodeDirectory=$2
  cd ${nodeDirectory}

  # TODO: deal with spaces better in onlyAllow list...
  ${LIB_DIR}/node_modules/.bin/license-checker  . \
    --excludePackages "${excludeList}" \
    --onlyAllow "${allowedList}" \
    --production --csv > ${output}
  result=$?

  if [ "${LOG_LEVEL}" == "info" ]; then
    cat ${output}
  fi

  return ${result}
}

function processDockerImage() {
  stepDockerImage=$@
  logStep "Processing docker image: ${stepDockerImage}"
  containerName=$(echo ${stepDockerImage} | awk -F"/|:" '{print $2}')

  mkdir -p /tmp/$containerName/node_modules

  docker rm -f $containerName  > /dev/null 2>&1 || logSubStep 'Container already stopped'
  docker pull $stepDockerImage

  # Check if the image exists, and we can pull it
  dockerPullResult=$?
  if [ ${dockerPullResult} -ne 0 ]; then
    logWarn "failed to pull docker image: ${stepDockerImage}. This may not be fatal"
  fi

  logSubStep "Creating $containerName from $stepDockerImage"

  # create a non-running container
  docker create --name $containerName $stepDockerImage

  dockerCreateResult=$?
  if [ ${dockerCreateResult} -ne 0 ]; then
    logErr "failed to create docker image: ${stepDockerImage}. Aborting"
    exit ${dockerCreateResult}
  fi

  # copy out node_modules - look in project root as well as .<project>/src and /src
  docker cp $containerName:/opt/$containerName/node_modules /tmp/$containerName/ > /dev/null 2>&1 
  docker cp $containerName:/opt/$containerName/src/node_modules /tmp/$containerName/ > /dev/null 2>&1 
  docker cp $containerName:/src/node_modules /tmp/$containerName/ > /dev/null 2>&1 

  # If node_modules is not found, look also in WORKDIR of docker image
  if [ ! "$(ls -A /tmp/${containerName}/node_modules)" ]; then
    workDirPath=$(docker inspect --format='{{.Config.WorkingDir}}' $containerName)
    if [ $? -eq 0 ]; then
      docker cp $containerName:$workDirPath/node_modules /tmp/$containerName/ > /dev/null 2>&1
      docker cp $containerName:$workDirPath/src/node_modules /tmp/$containerName/ > /dev/null 2>&1
    fi
  fi

  # check that the copy worked - this seems especially brittle
  if [ "$(ls -A /tmp/${containerName}/node_modules)" ]; then
    logSubStep "Copied node_modules successfully"
  else
    logErr "Fatal Error. Failed to copy node modules out of docker image: ${stepDockerImage}. Aborting"
    exit 1
  fi

  # run the license scan
  listLicenses ${containerName} /tmp/$containerName
  checkLicenses ${containerName} /tmp/$containerName
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
skipDockerImages=`echo ${skipDockerImages} | awk '{gsub(/[;]/," ");print}'`

# iterate through docker images and skipDockerImages
for OUTPUT in ${dockerImages}
do
  shouldSkip=0
  for SKIP_IMAGE in ${skipDockerImages}
  do
    if [[ ${OUTPUT} == *"${SKIP_IMAGE}"* ]]; then
      logStep "Skipping validation for ${OUTPUT}"
      shouldSkip=1
    fi
  done

  if [[ shouldSkip -eq 0 ]]; then
    processDockerImage ${OUTPUT}
  fi
done

exit 0

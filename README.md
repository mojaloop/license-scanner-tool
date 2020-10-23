# License-Scanner

TEMP TEST CLA~~

A tool for scanning the licenses of many Node projects at once. 

## Installation

```bash
make build
```

## Config

You can edit the configuration in `./config.toml`

### Environment Variables

In addition to the config defined in `./config.toml`, you can override the config file with the following Env variables:

| Environment variable | Description | Example values |
| -------------------- | ----------- | ------ |
| `mode`               | The mode to run the scanner in. Options are `docker`, `local`, `standalone` | `mode=docker` |
| `pathToRepo`         | The path of the repo to be scanned. Only respected when `mode = ci` | `pathToRepo=/home/project/ml-api-adapter` |
| `dockerImage`        | **DEPRECATED** use `dockerImages` instead. The name of the docker image to be scanned. Only respected when `mode = docker` | `dockerImage=mojaloop/ml-api-adapter:latest` |
| `dockerImages`       | A space separated list of dockerImages to scan. Only respected when `mode = docker` | `dockerImage="mojaloop/ml-api-adapter:latest mojaloop/central-ledger:latest"`


## Running

```bash
# install the tool and clone all of the repos defined in `config.toml`
make build

# run the analysis
make run

# export an .xlsx summary file
make postprocess

# uninstall the tool, remove the repos and results
make cleanup
```

## Updating License and Package Whitelist

In order consistently manage the whitelist of licenses and packages, we use the same `config.toml` file across all Mojaloop projects.

__Adding a new License identifier to the whitelist:__

Edit `config.tml`, and add the license string into the `allowedList` array:
```
allowedList = [
  "AFLv2.1",
  "Apache License, Version 2.0",
  "Apache*",
  "Apache-2.0",
  "BSD"
  ...
]
```

Once your change is in master, all CircleCI using the license-scanner will be affected. This means that if you remove an allowed license from the list, you could cause breaks across many repos. So be careful!


__Adding a new package to the whitelist:__

In addition to maintaining the license list, we whitelist packages that we have manually audited and are happy to include.
The most common case for this is packages that don't have a license entry in the `package.json` file, which the npm license scan tool lists as `UNKNOWN`.


## Using in CI mode

You can also use license_scanner to scan the a repo as part of a CI step, which defines common steps using `make`, and a common default config in `config.toml`

Refer to `config.ci.toml` for an example of how to set up this tool for running as part of a CI process.

>_Note:_ You can also find a complete example of license-scanner in action on the [ml-api-adapter](https://github.com/mojaloop/ml-api-adapter/blob/master/.circleci/config.yml)

In short:

__1. Clone the project and set up defaults__

```bash
git clone https://github.com/mojaloop/license-scanner /tmp/license-scanner
cd /tmp/license-scanner
make build default-files
```

__2. Set up the license-scanner__
```bash
cd /tmp/license-scanner && make set-up
```

__3. edit the config for your project__
Open the `config.toml` file, and edit the following entries:

* change `pathToRepo` to point to your repo, or override this with a `pathToRepo` env variable
* define your packages to ignore in `excludeList`
* add licenses you explicitly allow in `allowedList`


__4. Run__

```bash
cd /tmp/license-scanner && pathToRepo=/path/to/repo make run
```

_If this fails, then your project does not pass the license checker_

__5. Access the results in `./results/`__


### Example CircleCI YAML:

>This example is taken from the `ml-api-adapter`

```yaml
defaults_license_checker: &defaults_license_checker |
    git clone https://github.com/mojaloop/license-scanner /tmp/license-scanner
    cd /tmp/license-scanner
    make build default-files

...
audit-licenses:
  <<: *defaults_working_directory
  <<: *defaults_docker_node
  steps:
    - run:
        name: Install general dependencies
        command: *defaults_Dependencies
    - run:
        name: Install license_checker
        command: *defaults_license_checker
    - checkout
    - restore_cache:
        key: dependency-cache-{{ checksum "package.json" }}
    - run:
        name: Set up License Checker
        command: cd /tmp/license-scanner && make set-up
    - run:
        name: Run the license-scanner
        command: cd /tmp/license-scanner && pathToRepo=$CIRCLE_WORKING_DIRECTORY make run
    - store_artifacts:
        path: /tmp/license-scanner/results
        prefix: licenses
...
```

## Using in Docker mode

Docker mode evaluates the licenses for `node_modules` inside of build docker images. This is used in the Mojaloop as a sanity check to ensure that we haven't accidentally packaged and shipped modules that contain unwanted licenses.


Refer to `config.docker.example.toml` for an example of how to set up this tool for running in docker mode. Alternatively, you can run the tool as follows:
```
export mode=docker
export dockerImages="<space separated list of docker images>
make run
```

>_Note:_ You can also find a complete example of license-scanner in action on the [ml-api-adapter](https://github.com/mojaloop/ml-api-adapter/blob/master/.circleci/config.yml)




# License-Scanner

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
| `dockerImage`        | The name of the docker image to be scanned. Only respected when `mode = docker` | `dockerImage=mojaloop/ml-api-adapter:latest` |


## Running

```bash
# clone all of the repos defined in `config.toml`
make set-up

# run the analysis
make run

# if you chose `lc-summary` or `csv`, results will be available in the results dir 

# get your disk space back
make cleanup

```

## Updating License Blacklist and Package Whitelist

In order consistently manage the blacklisted licences and whitelisted packages, we use the same `config.toml` file across all Mojaloop projects.

__Adding a new Licence identifier to the blacklist:__

Edit `config.tml`, and add the licence string into the `failList` array:
```
failList = [
  "UNKNOWN",
  "GPL-1.0",
  "GPL-2.0",
  "GPL-3.0",
  #add your license here
]
```

Once your change is in master, all CircleCI builds will fail if that identifier is found.


__Adding a new package to the whitelist:__

In addition to maintaining a blacklist of licenses, we whitelist packages that we have manually audited and are happy to include.
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
* add licenses you won't allow in `failList`


__4. Run__

```bash
cd /tmp/license-scanner && pathToRepo=/path/to/repo make run
```

_If this fails, then your project does not pass the license checker_

__5. Access the results in `./results/`__


### Example CircleCI YAML:

//TODO: update
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


Refer to `config.docker.toml` for an example of how to set up this tool for running in docker mode.

>_Note:_ You can also find a complete example of license-scanner in action on the [ml-api-adapter](https://github.com/mojaloop/ml-api-adapter/blob/master/.circleci/config.yml)


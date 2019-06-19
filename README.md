# License-Scanner

A tool for scanning licenses of many nodejs projects at once. 

## Installation

```bash
make build
```

## Config

You can edit the configuration in `./config.toml`


## Running

```bash
# clone all of the repos defined in `config.toml`
make set-up

# run the analysis
make run

# if you chose `fossa-json` or `csv`, results will be available in the results dir 

# get your disk space back
make cleanup

```


## Using in CI mode

You can also use license_scanner to scan the a repo as part of a CI step, which defines common steps using `make`, and a common default config in `config.toml`

Refer to `config.ci.toml` for an example of how to set up this tool for running as part of a CI process.

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




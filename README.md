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

__1. Clone the project and build__

```bash
git clone [todo: add link]
cd license_scanner && make build
```

__2. copy the default settings from config.ci.toml, and make a .env file__
```bash
#from license_scanner dir
cp config.ci.toml config.toml
cp .env.template .env
```

__3. edit the config for your project__

[todo: make these configurable with env var?]
* change `pathToRepo` to point to your repo
* define your packages to ignore in `excludeList`
* add licenses you won't allow in `failList`


__4. Set up the repo__
```bash
make set-up
```

__5. Run__

``bash
make run
```

_If this fails, then your project does not pass the license checker

__6. Access the results in `./results/`__




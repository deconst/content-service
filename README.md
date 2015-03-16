## Content-Service

A basic content storage and retrieval service. Requires Docker to run.

### Setup

```
$ npm run docker-build
```

This will install the basic dependencies required to run the content service. Before you run however, you'll have to configure your environment

### Environment

In order to configure your environment, you'll need to setup your environment variables. There is a sample in `environment.sample.sh` that you can copy, or you can set them up manually.

Running the content service requires the following environment variables to be passed to Docker:

- `RACKSPACE_USERNAME` the username for your Rackspace account
- `RACKSPACE_APIKEY` the api key for your Rackspace account
- `RACKSPACE_REGION` region for the content service to use
- `RACKSPACE_CONTAINER` container to use for the content service

You can optionally set a default log level by using the environment variable `CONTENT_LOG_LEVEL`.

The valid levels are: `TRACE`, `DEBUG`, `VERBOSE`, `INFO` (Default), `WARN`, and `ERROR`.


### Start

To start the process, invoke docker:

```
npm run docker-run
```

### Output

```
> content-service@1.0.0 start /usr/src/app
> node app.js

2015-03-13T15:48:14.839Z - info: content-service listening at http://0.0.0.0:8080
```
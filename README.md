## Content-Service

A basic content storage and retrieval service. Requires Docker to run.

### Setup

```
$ docker build -t content-service .
```

This will install the basic dependencies required to run the content service.

### Environment

Running the content service requires the following environment variables to be passed to Docker:

- `RACKSPACE_USERNAME` the username for your Rackspace account
- `RACKSPACE_API_KEY` the api key for your Rackspace account
- `RACKSPACE_REGION` region for the content service to use
- `RACKSPACE_CONTAINER` container to use for the content service

You can optionally set a default log level by using the environment variable `CONTENT_LOG_LEVEL`.

The valid levels are: `TRACE`, `DEBUG`, `VERBOSE`, `INFO` (Default), `WARN`, and `ERROR`.

### Start

To start the process, invoke docker:

```
docker run -it --rm --name content-service-running
    -e RACKSPACE_USERNAME=my-user-name
    -e RACKSPACE_API_KEY=my-api-key
    -e RACKSPACE_REGION=iad
    -e RACKSPACE_CONTAINER=content-service
    -e CONTENT_LOG_LEVEL=debug
    content-service
```

### Output

```
> content-service@1.0.0 start /usr/src/app
> node app.js

2015-03-13T15:48:14.839Z - info: content-service listening at http://0.0.0.0:8080
```
## Content-Service

A basic content storage and retrieval service. Requires a configured environment in order to run.

### Setup

```
$ npm install
```

This will install the basic dependencies required to run the content service.

### Environment

Running the content service requires the following environment variables to be configured:

- `RACKSPACE_USERNAME` the username for your Rackspace account
- `RACKSPACE_API_KEY` the api key for your Rackspace account
- `RACKSPACE_REGION` region for the content service to use
- `RACKSPACE_CONTAINER` container to use for the content service

You can optionally set a default log level by using the environment variable `CONTENT_LOG_LEVEL`.

The valid levels are: `TRACE`, `DEBUG`, `VERBOSE`, `INFO` (Default), `WARN`, and `ERROR`.

### Start

To start the process, simply invoke `npm start`.

### Output

```
$ npm start
2015-03-13T15:14:33.055Z - info: content-service listening at http://0.0.0.0:8080
```
# Content Service

A content storage and retrieval service for deconst.

[![Build Status](https://travis-ci.org/deconst/content-service.svg?branch=master)](https://travis-ci.org/deconst/content-service)

## Setup

To develop locally, you'll need to install:

 * [Docker](https://docs.docker.com/installation/#installation) to build and launch the container.
 * [docker-compose](https://docs.docker.com/compose/install/) to manage the container's configuration.

Then, you can build and run the service with:

```bash
# See below for service configuration.
export RACKSPACE_USERNAME=...
export RACKSPACE_APIKEY=...

docker-compose build && docker-compose up -d
```

## Configuration

The content service is configured by passing environment variables to the Docker container. These are the available configuration options:

 * `RACKSPACE_USERNAME`: **(Required)** the username for your Rackspace account.
 * `RACKSPACE_APIKEY`: **(Required)** the API key for your Rackspace account.
 * `RACKSPACE_REGION`: **(Required)** the Rackspace region for the content service to use.
 * `RACKSPACE_CONTAINER`: **(Required)** container name to use for the content service.
 * `CONTENT_LOG_LEVEL`: Optional logging level. The valid levels are `TRACE`, `DEBUG`, `VERBOSE`, `INFO` (Default), `WARN`, and `ERROR`.

In development mode, docker-compose provides defaults for everything but `RACKSPACE_USERNAME` and `RACKSPACE_APIKEY`.

## API

The content service exposes the following API endpoints:

### `GET /version`

Report the service name, version, and git commit.

*Response*

```json
{
    "commit": "e2af254",
    "service": "content-service",
    "version": "1.0.0"
}
```

### `PUT /content`

Store and index content with a specific URL-encoded *content ID*.

*Request*

The request payload must be a JSON document matching the following schema:

```json
{
  "id": "https://github.com/deconst/deconst-docs/content/id/here",
  "body": { }
}
```

*Response: Successful*

An HTTP status of 200 and an empty response body will be returned when content is accepted successfully.

### `GET /content/:id`

Access previously stored content by its URL-encoded *content ID*.

*Response: Successful*

The exact JSON document provided to `PUT /content` will be returned.

*Response: Unsuccessful*

An HTTP status of 404 will be returned if the content ID isn't recognized.

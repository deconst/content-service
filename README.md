# Content Service

A content storage and retrieval service for deconst.

[![Build Status](https://travis-ci.org/deconst/content-service.svg?branch=master)](https://travis-ci.org/deconst/content-service)
[![Docker Repository on Quay.io](https://quay.io/repository/deconst/content-service/status "Docker Repository on Quay.io")](https://quay.io/repository/deconst/content-service)

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
 * `ADMIN_APIKEY`: **(Required)** an API key that can be used by administrators or other internal services to issue and revoke API keys.
 * `CONTENT_CONTAINER`: **(Required)** container name to use for the stored metadata envelopes.
 * `ASSET_CONTAINER`: **(Required)** container name to use for published assets.
 * `CONTENT_LOG_LEVEL`: Optional logging level. The valid levels are `TRACE`, `DEBUG`, `VERBOSE`, `INFO` (Default), `WARN`, and `ERROR`.

Both Cloud Files containers will be created and configured on application launch if they do not already exist.

In development mode, docker-compose provides defaults for everything but `RACKSPACE_USERNAME` and `RACKSPACE_APIKEY`.

## API

### Authorization

Endpoints that require authorization *must* be accompanied by a valid API key. Set the API key in
an `Authorization` header.

```
PUT /content/https%3A%2F%2Fgithub.com%2Fsomeuser%2Fsomerepo%2Fsomeid
Authorization: deconst apikey="12345"
```

Valid API keys include:

 * The admin API key, as specified by [the service configuration.](#configuration)
 * User keys issued by the [`POST /keys`](#post-keysnamedname) endpoint.

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

### `PUT /content/:id`

**(Authorization required: any user)**

Store and index content with a specific URL-encoded *content ID*.

*Request*

The request payload must be a valid Deconst metadata envelope in JSON form.

```json
{
  "title": "Optional page title",
  "body": "<h1>page content</h1> <p>as raw HTML</p>"
}
```

*Response: Successful*

An HTTP status of 200 and an empty response body will be returned when content is accepted successfully.

### `DELETE /content/:id`

**(Authorization required: any user)**

Delete content with a specific URL-encoded *content ID*.

*Response: Successful*

An HTTP status of 204 indicates that the content has been deleted successfully.

*Response: Unsuccessful*

An HTTP status of 404 will be returned if the content ID isn't recognized.

### `GET /content/:id`

Access previously stored content by its URL-encoded *content ID*.

*Response: Successful*

```json
{
  "assets": {},
  "envelope": {}
}
```

`"envelope"` will be the exact JSON document provided to `PUT /content`. `"assets"` will contain a set of site-wide layout asset variables.

*Response: Unsuccessful*

An HTTP status of 404 will be returned if the content ID isn't recognized.

### `POST /asset[?named=true]`

Fingerprint and publish one or more static assets to a CDN-enabled Cloud Files container. Return the full URLs to the published assets.

*Request*

The request payload must be a `multipart/form-data` file upload containing the assets to upload. The content type of each file must be set appropriately.

If the query parameter `named=true` is provided, each asset's CDN URI will also be persisted in the *layout asset map* with a key derived from its form name and inserted in the `assets` object of every outgoing metadata envelope.

*Response*

```json
{
  "file1.jpg": "https://assets.horse/url/for/file1-38be7d1b981f2fb6a4a0a052453f887373dc1fe8.jpg",
  "file2.css": "https://assets.horse/url/for/file2-d2da57e04b0818f7e3dd18da3b73c9b54a73cbe5.css"
}
```

### `POST /keys?named=:name`

**(Authorization required: admin only)**

Issue a newly generated API key. The provided human-friendly name will be used to log actions performed with this key.

*Response: Successful*

```json
{
  "apikey": "6aa856c50e5c8895020ef8d35..."
}
```

*Response: Unsuccessful*

An HTTP status code of 401 indicates that the request did not contain a valid administrator API key.

### `DELETE /keys/:apikey`

**(Authorization required: admin only)**

Revoke a previously issued user API key.

*Response: Successful*

An HTTP status code of 204 indicates that the API key will no longer be valid.

*Response: Unsuccessful*

An HTTP status code of 401 indicates that the request did not contain a valid administrator API key. A 409 is generated if an administrator attempts to revoke their own key.

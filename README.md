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
# Customize your environment settings.
cp environment.sample.sh environment.sh
${EDITOR} environment.sh
source environment.sh

docker-compose build
docker-compose up
```

## Configuration

The content service is configured by passing environment variables to the Docker container. These are the available configuration options:

 * `STORAGE`: *(default: `"remote"`)* Specify `memory` to use entirely in-memory storage, or `remote` to use external storage services.
 * `ADMIN_APIKEY`: **(required)** An API key that can be used by administrators or other internal services to issue and revoke API keys.

### Remote services

 * `RACKSPACE_USERNAME`: **(required if STORAGE=remote)** The username for your Rackspace account.
 * `RACKSPACE_APIKEY`: **(required if STORAGE=remote)** The API key for your Rackspace account.
 * `RACKSPACE_REGION`: **(required if STORAGE=remote)** The Rackspace region for the content service to use.
 * `RACKSPACE_SERVICENET`: *(default: `"false"`)* If `"true"`, connect to Cloud Files over ServiceNet rather than the public endpoint.
 * `CONTENT_CONTAINER`: **(required if STORAGE=remote)** Container name to use for the stored metadata envelopes.
 * `ASSET_CONTAINER`: **(required if STORAGE=remote)** Container name to use for published assets.
 * `MONGODB_URL`: **(required if STORAGE=remote)** MongoDB connection string, including any required authentication information.
 * `MONGODB_PREFIX`: **(default: `""`)** Prefix used to partition MongoDB collection names from other services using the same MongoDB database.
 * `ELASTICSEARCH_HOST`: **(required if STORAGE=remote)** Elasticsearch connection string, including any required authentication information.

### Memory storage

 * `MEMORY_ASSET_PREFIX`: **(default: `"/__local_asset__/"`)** Prefix used to construct URLs for assets present in memory storage.

### Staging

 * `STAGING_MODE`: *(default: `"false"`)* Act as a staging store, to stage many revisions of content simultaneously. When staging mode is active, proxied content IDs will have their first URL path segment, the revision ID, removed when making the upstream request.
 * `PROXY_UPSTREAM`: *(required if STAGING_MODE=true)* If a URL is specified, content not found in this content store will be requested from an upstream content store API. Named assets will be accumulated from the upstream content store and this service, with named assets from this service taking precedence.

### Logging

 * `CONTENT_LOG_LEVEL`: *(default: `"info"`)* Optional logging level, case-insensitive. The valid levels are `TRACE`, `DEBUG`, `VERBOSE`, `INFO`, `WARN`, and `ERROR`.
 * `CONTENT_LOG_COLOR`: *(default: `"false"`)* Logging colorization. Set to `"true"` to enable colorful logs.
 * `NODE_ENV`: If set to `"production"`, logs will be emitted as JSON objects.

Both Cloud Files containers will be created and configured on application launch if they do not already exist.

# Deconst Dev Env in Kubernetes with Minikube

These instructions will create the resources necessary to run the deconst content service in a dev env in Kubernetes with Minikube.

1. Run through [Deconst Dev Env in Kubernetes with Minikube](https://github.com/deconst/deploy#deconst-dev-env-in-kubernetes-with-minikube)

1. Customize your environment settings

    For a basic dev env setup, the only value you need to set in `environment.sh` is `ADMIN_APIKEY`.

    ```bash
    cp environment.sample.sh environment.sh
    ${EDITOR} environment.sh
    source environment.sh
    ```

1. Create resources

    ```bash
    script/template kubernetes/deployment.yaml | kubectl apply -f -
    ```

1. Watch and wait for resources

    ```bash
    watch kubectl get pods --namespace deconst
    ```

1. Test that the content service is nominally working

    ```bash
    curl $(minikube service --url --namespace deconst content)/version
    ```

1. Delete resources

    ```bash
    kubectl delete deployments --namespace deconst content
    kubectl delete services --namespace deconst content    
    ```

## API

### Authorization

Endpoints that require authorization *must* be accompanied by a valid API key. Set the API key in
an `Authorization` header with a scheme of "deconst".

```
PUT /content/https%3A%2F%2Fgithub.com%2Fsomeuser%2Fsomerepo%2Fsomeid
Authorization: deconst 12345
```

Or:

```bash
curl -H 'Authorization: deconst 12345' # ...
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

### `GET /content/[?prefix=:id_prefix&pageNumber=:num&perPage=:size]`

List content IDs available within the content service, paginated. If `:id_prefix` is provided, list only content IDs beginning with that prefix.

The default page size is 100 content IDs.

*Response: Successful*

On success, the response includes an HTTP status of 200 and contains a JSON payload containing zero to many matching content IDs.

```json
{
  "total": 123,
  "results": [
    {
      "contentID": "<matching content ID>",
      "url": "<API URL to fetch envelope contents>"
    }
  ]
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

### `DELETE /content/:id[?prefix=true]`

**(Authorization required: any user)**

Delete content with a specific URL-encoded *content ID*. If '?prefix=true' is specified, delete *all content* with a content ID with the `:id` parameter as a prefix.

:warning: Use caution when bulk-deleting content from production. Ensure that no other mapped content that you *don't* wish to delete shares a prefix with the `:id` you provide. :warning:

*Response: Successful*

An HTTP status of 204 indicates that the content has been deleted successfully.

*Response: Unsuccessful*

An HTTP status of 404 will be returned if the content ID isn't recognized.

### `GET /content/:id`

Access previously stored content by its URL-encoded *content ID*.

*Response: Successful*

```json
{
  "envelope": {
    "body": "<h1>The content... </h1>"
  }
}
```

`"envelope"` will be the exact JSON document provided to `PUT /content`. `"assets"` will contain a set of site-wide layout asset variables.

*Response: Unsuccessful*

An HTTP status of 404 will be returned if the content ID isn't recognized.

### `POST /bulkcontent`

**(Authorization required: any user)**

Bulk-upload content from a `.tar.gz` file.

*Request*

The POST body must be a `.tar.gz` file in the following format:

```
metadata/config.json  # Optional: config file
metadata/keep.json    # Optional: additional content IDs to keep
https%3A%2F%2Fgithub.com%2Fsomeorg%2Fsomerepo.json  # metadata envelopes with URL-encoded filenames
https%3A%2F%2Fgithub.com%2Fsomeorg%2Fsomerepo%2Fpageone.json
https%3A%2F%2Fgithub.com%2Fsomeorg%2Fsomerepo%2Fpagetwo.json
```

The `config.json` file, if present, should contain:

```json
{
  "contentIDBase": "https://github.com/someorg/somerepo"
}
```

All envelopes that share the named content ID base which are not included in the tarball or mentioned in `keep.json` will be removed as part of this operation.

The `keep.json` file, if present, should contain:

```json
{
  "keep": [
    "https://github.com/someorg/somerepo/oldpage1",
    "https://github.com/someorg/somerepo/oldpage2"
  ]
}
```

*Response: Successful*

An HTTP status of 200 is returned once all envelopes are accepted successfully. The response body reports counts of the actions taken:

```json
{
  "accepted": 24,
  "failed": 0,
  "deleted": 12
}
```

*Response: Unsuccessful*

An HTTP status of 500 is returned if there are problems accepting one or more envelopes. The response body reports how many envelopes from the bundle failed:

```json
{
  "accepted": 21,
  "failed": 3,
  "deleted": 12
}
```

Note that the successful envelopes *were* accepted and are live.

### `GET /checkcontent`

Perform a bulk query to determine which envelopes need to be updated and which are unchanged.

*Request*

Attach a body to the GET request containing a JSON object mapping content IDs to SHA-256 checksums. Generate each checksums from a compact (whitespace-less) JSON representation with sorted object keys.

```json
{
  "https://github.com/org/repo": "b1b6e4c544880769b42bdbf7f6338cba3db78cf734424af20e5c4d30251a984c",
  "https://github.com/org/repo/somepath": "0ff459af6d050d72d642eeb3a1ea5a8a93fd518993ac56711bd86a7e49b95191"
}
```

*Response (successful)*

The response will have a 200 status and a response body containing the queried content IDs and a boolean value of:

* `true` if the envelope with that ID is already present and its checksum matches, or
* `false` if the envelope is either missing entirely or its checksum differs.

The envelope that's queried for a fingerprint match is the envelope that would be rendered for a `GET /content/:id` request against this endpoint. In staging mode, this means that an envelope that's present in the local store with a different checksum will return `false` even if the upstream content service has that envelope with a matching checksum.

```json
{
  "https://github.com/org/repo": true,
  "https://github.com/org/repo/somepath": false
}
```

*Response (unsuccessful)*

A status of 500 indicates that an internal storage error occurred. A status of 502 indicates that the content store is configured to proxy to an upstream service, but it couldn't be reached.

### `POST /assets[?named=true]`

**(Authorization required: any user)**

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

### `GET /assets`

Enumerate named assets from the content service.

*Response*

```json
{
  "file1_jpg_url": "https://assets.horse/url/for/file1-38be7d1b981f2fb6a4a0a052453f887373dc1fe8.jpg",
  "file2_css_url": "https://assets.horse/url/for/file2-d2da57e04b0818f7e3dd18da3b73c9b54a73cbe5.css"
}
```

### `GET /assets/:filename`

Fetch an asset directly by filename. Most useful when you're using `STORAGE=memory`; otherwise you should use the CDN URLs.

*Successful Response*

Return an HTTP status of 200, the correct content-type, and the asset body.

*Unsuccessful Response*

A response of 400 is returned if no asset with that filename exists.

### `POST /bulkasset`

**(Authorization required: any user)**

Bulk-upload assets from a `.tar.gz` file.

*Request*

The POST body must be a `.tar.gz` file with a content-type of `application/tar+gzip`.

*Successful Response*

Returns an HTTP status of 200 and a map containing the tarball's path to each asset and its corresponding public CDN URL:

```json
{
  "assets/0.png": "https://9b1a5535446999eb0355-a76b79aca86ab4305d3e9ef5c9a01022.ssl.cf5.rackcdn.com/0-ed56e65d28de88bbbfafc33e7c959b764e5c8aa35ad9874966dfda9d46b8b28e.png",
  "assets/100.png": "https://9b1a5535446999eb0355-a76b79aca86ab4305d3e9ef5c9a01022.ssl.cf5.rackcdn.com/100-6ae71f29cf579f37139540c32a42fe4078b24d95c5453acaf3be2b6909e175e4.png"
}
```

*Unsuccessful Response*

If the uploaded file is not a valid tarball, an HTTP status of 400 will be returned. If there are problems performing the batch upload an HTTP status of 500 will be returned.

### `GET /checkassets`

Perform a bulk query to determine which assets need to be uploaded and which are already present.

*Request*

Attach a body to the GET request containing a JSON object mapping asset filenames to SHA-256 checksums.

```json
{
  "header.jpg": "08facdf9cdab2065dd76d0c50c20d93141c1e2be8a1224782458b0f41ad04eee",
  "local/path/style.min.css": "5746528f57f4c571bcbcdd7334b4396277877488bff0207603d7fb829fa7f854"
}
```

*Response (successful)*

The response will have a 200 status and a response body mapping the queried paths to:

* The known asset's public CDN URL if an asset with that filename and checksum is already present, or
* `null` if no such asset exists.

In staging mode, the upstream content store will be queried for any assets that are not present locally.

```json
{
  "header.jpg": "https://my.awesome.cdn/public/header-08facdf9cdab2065dd76d0c50c20d93141c1e2be8a1224782458b0f41ad04eee.jpg",
  "local/path/style.min.css": null
}
```

*Response (unsuccessful)*

A status of 500 indicates that an internal storage error occurred. A status of 502 indicates that the content store is configured to proxy to an upstream service, but it couldn't be reached.

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

### `GET /search?q=:term&pageNumber=:num&perPage=:size&categories=deconst.horse`

Perform a full-text search against all indexed documents.

`q` is a required parameter. `pageNumber` defaults to 1 if unspecified, and `perPage` defaults to 10. `categories` may be specified multiple times (or as `categories[]`), and if present at least once, will constrain search results to only those envelopes that contain at least one matching category.

*Response: Successful*

```json
{
  "total": 100,
  "results": [
    {
      "contentID": "https://github.com/deconst/deconst-docs/one",
      "title": "First result title",
      "excerpt": "body excerpt with matching text <em>highlighted</em>"
    },
    {
      "contentID": "https://github.com/deconst/deconst-docs/two",
      "title": "Second result title",
      "excerpt": "first bit of the body if no body content matched"
    }
  ]
}
```

### `PUT /control`

**(Authorization required: any user)**

Change the stored control repository SHA.

*Request*

The request payload must be a JSON object containing a 40-character git commit SHA.

```json
{
  "sha": "f2fa39527c7b35b9960fd39e2eb77217db3ee517"
}
```

*Response: Successful*

A status code of 204 indicates that the new SHA has been accepted.

*Response: Unsuccessful*

An HTTP status code of 401 indicates that the request did not contain a valid API key. A status code of 400 indicates that the request body did not contain an appropriately formatted JSON document.

### `GET /control`

Retrieve the most recently stored control repository SHA.

*Response: Successful*

If a control repository SHA has been stored:

```json
{
  "sha": "f2fa39527c7b35b9960fd39e2eb77217db3ee517"
}
```

If no SHA has been stored yet:

```json
{
  "sha": null
}
```

### `POST /reindex`

**(Authorization required: admin only)**

Asynchronously reindex all content from the primary key-value content store in the full-text search store.

*Response: Unsuccessful*

An HTTP status code of 401 indicates that the request did not contain a valid administrator API key.

*Response: Successful*

A status code of 202 indicates the reindexing has begun. Watch the container's logs to see indexing progress.

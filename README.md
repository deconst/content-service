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

### Start

To start the process, simply invoke `npm start`.

### Output

```
$ npm start
restify listening at http://0.0.0.0:8080
```
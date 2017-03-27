# An API key that can be used by administrators or other internal services
export ADMIN_APIKEY=

# Set to "production" to simulate production more closely.
export NODE_ENV=development

export DOCKER_IMAGE=quay.io/deconst/content-service

# Set to "remote" to use remote storage.
export STORAGE=memory

# Required only if STORAGE is "remote".
export RACKSPACE_USERNAME=
export RACKSPACE_APIKEY=
export RACKSPACE_REGION=
export RACKSPACE_SERVICENET=

export CONTENT_CONTAINER=
export ASSET_CONTAINER=

export MONGODB_URL=
export ELASTICSEARCH_HOST=

# Enable to proxy failed content requests to another content service.
# export PROXY_UPSTREAM=

export CONTENT_LOG_LEVEL=debug
export CONTENT_LOG_COLOR="true"

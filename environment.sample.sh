# Set to "production" to simulate production more closely.
export NODE_ENV=development

# Set to "remote" to use remote storage.
export STORAGE=memory

# Required only if STORAGE is "remote".
export RACKSPACE_USERNAME=
export RACKSPACE_APIKEY=
export RACKSPACE_REGION=
export RACKSPACE_SERVICENET=
export CONTENT_CONTAINER=
export ASSET_CONTAINER=
export ADMIN_APIKEY=

# Enable to proxy failed content requests to another content service.
# export PROXY_UPSTREAM=

export CONTENT_LOG_LEVEL=debug
export CONTENT_LOG_COLOR="true"

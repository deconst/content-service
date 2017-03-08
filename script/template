#!/bin/bash

cat $1 > /dev/null
err=$(eval "echo \"$(cat $1)\"" 2>&1 >/dev/null)
[ "$err" == "" ] || (>&2 echo "$err" && return 1)
eval "echo \"$(cat $1)\""

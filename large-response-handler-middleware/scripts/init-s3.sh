#!/bin/sh

export AWS_PAGER=""

if ! command -v awslocal &> /dev/null; then
    alias awslocal="aws --endpoint ${AWS_ENDPOINT:-http://localhost:4566}"
fi

awslocal s3 mb s3://the-bucket-list

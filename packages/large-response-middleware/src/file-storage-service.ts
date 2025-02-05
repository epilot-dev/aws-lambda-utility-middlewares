import path from 'node:path';

import { getS3Client } from './s3/s3-client';

import type { FileUploadContext } from '.';

/**
 * Uploads a file to S3.
 *
 * @returns a presigned URL expiring in 60 minutes for easy access.
 */
export const uploadFile = async (params: FileUploadContext) => {
  const client = await getS3Client();
  const namespace = params.groupId || 'all';
  const date = getFormattedDate();
  const outputKey = `${namespace}/${date}/${encodeURIComponent(params.fileName)}`;

  await client
    .putObject({
      Bucket: params.bucket,
      Key: outputKey,
      ContentType: params.contentType || 'text/plain',
      Body: JSON.stringify(params.content || {}),
      ACL: 'private',
    })
    .promise();

  const url = await client.getSignedUrl('getObject', {
    Expires: 3600,
    Bucket: params.bucket,
    Key: outputKey,
    ResponseContentDisposition: `inline;filename=${path.basename(outputKey)}`,
  });

  return { url, filename: outputKey };
};

function getFormattedDate() {
  const date = new Date();

  return date.toISOString().split('T')[0];
}

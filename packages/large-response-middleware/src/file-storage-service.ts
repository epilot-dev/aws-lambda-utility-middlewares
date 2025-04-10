import path from 'node:path';

import { getS3Client } from './s3/s3-client';

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

  await client.send(
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: outputKey,
      ContentType: params.contentType || 'text/plain',
      Body: JSON.stringify(params.content || {}),
      ACL: 'private',
    }),
  );

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: params.bucket,
      Key: outputKey,
      ResponseContentDisposition: `inline;filename=${path.basename(outputKey)}`,
    }),
    {
      expiresIn: 3600,
    },
  );

  return { url, filename: outputKey };
};

function getFormattedDate() {
  const date = new Date();

  return date.toISOString().split('T')[0];
}

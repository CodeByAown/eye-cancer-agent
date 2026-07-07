from __future__ import annotations

import anyio

from app.core.config import settings
from app.services.storage.base import Storage, StoredObject


class S3Storage(Storage):
    """S3 / Cloudflare R2 storage (production).

    boto3 is a sync client; calls are offloaded to a worker thread so the async
    event loop is never blocked. Requires the `storage-s3` extra (boto3).
    """

    def __init__(self) -> None:
        try:
            import boto3  # noqa: PLC0415
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "S3 storage selected but boto3 is not installed. Install extra: pip install '.[storage-s3]'"
            ) from exc

        if not settings.s3_bucket:
            raise RuntimeError("STORAGE_BACKEND=s3 requires S3_BUCKET")

        self.bucket = settings.s3_bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )

    async def put(
        self, key: str, data: bytes, *, content_type: str = "application/octet-stream"
    ) -> StoredObject:
        await anyio.to_thread.run_sync(
            lambda: self._client.put_object(
                Bucket=self.bucket, Key=key, Body=data, ContentType=content_type
            )
        )
        return StoredObject(key=key, url=self.url_for(key), size=len(data), content_type=content_type)

    async def get(self, key: str) -> bytes:
        def _get() -> bytes:
            obj = self._client.get_object(Bucket=self.bucket, Key=key)
            return obj["Body"].read()

        return await anyio.to_thread.run_sync(_get)

    async def delete(self, key: str) -> None:
        await anyio.to_thread.run_sync(
            lambda: self._client.delete_object(Bucket=self.bucket, Key=key)
        )

    async def exists(self, key: str) -> bool:
        def _head() -> bool:
            try:
                self._client.head_object(Bucket=self.bucket, Key=key)
                return True
            except Exception:
                return False

        return await anyio.to_thread.run_sync(_head)

    def url_for(self, key: str, *, expires_in: int = 3600) -> str:
        if settings.s3_public_base_url:
            return f"{settings.s3_public_base_url.rstrip('/')}/{key}"
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

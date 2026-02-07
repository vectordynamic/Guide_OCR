"""
R2/S3 Storage Service
Handles uploading images to Cloudflare R2 (S3-compatible).
"""
import os
import boto3
from typing import Optional
from botocore.config import Config
from app.core.config import settings


class R2Storage:
    """Cloudflare R2 storage service (S3-compatible)."""
    
    def __init__(self):
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
            region_name="auto"
        )
        self.bucket = settings.R2_BUCKET_NAME
        self.public_domain = settings.R2_PUBLIC_DOMAIN
    
    def upload_file(
        self,
        local_path: str,
        remote_path: str,
        content_type: str = "image/png"
    ) -> str:
        """
        Upload a file to R2.
        
        Args:
            local_path: Local file path
            remote_path: Path in bucket (e.g., books/123/chapters/ch_01/page_001.png)
            content_type: MIME type
            
        Returns:
            Public URL of uploaded file
        """
        with open(local_path, "rb") as f:
            self.client.put_object(
                Bucket=self.bucket,
                Key=remote_path,
                Body=f,
                ContentType=content_type
            )
        
        return self.get_public_url(remote_path)
    
    def upload_chapter_page(
        self,
        local_path: str,
        book_id: str,
        chapter_num: int,
        page_number: int
    ) -> str:
        """
        Upload a chapter page image with structured path.
        
        Path format: books/{book_id}/chapters/ch_{num}/page_{num}.png
        """
        filename = os.path.basename(local_path)
        remote_path = f"books/{book_id}/chapters/ch_{chapter_num:02d}/{filename}"
        return self.upload_file(local_path, remote_path)
    
    def get_public_url(self, remote_path: str) -> str:
        """Get public URL for a file."""
        return f"{self.public_domain}/{remote_path}"
    
    def delete_file(self, remote_path: str) -> bool:
        """Delete a file from R2."""
        try:
            self.client.delete_object(Bucket=self.bucket, Key=remote_path)
            return True
        except Exception:
            return False
    
    def list_files(self, prefix: str) -> list:
        """List files with given prefix."""
        response = self.client.list_objects_v2(
            Bucket=self.bucket,
            Prefix=prefix
        )
        return [obj["Key"] for obj in response.get("Contents", [])]


# Singleton instance
_r2_storage: Optional[R2Storage] = None


def get_r2_storage() -> R2Storage:
    """Get R2 storage singleton."""
    global _r2_storage
    if _r2_storage is None:
        _r2_storage = R2Storage()
    return _r2_storage

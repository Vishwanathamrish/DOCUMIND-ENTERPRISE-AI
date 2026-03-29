"""
Password reset token management service
"""

import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict
from app.database import get_db
import logging

logger = logging.getLogger(__name__)


class PasswordResetTokenService:
    """Service for managing password reset tokens"""
    
    TOKEN_EXPIRY_HOURS = 1
    
    @staticmethod
    def generate_token() -> str:
        """Generate a secure random token"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def hash_token(token: str) -> str:
        """Hash token for secure storage"""
        return hashlib.sha256(token.encode()).hexdigest()
    
    @classmethod
    def create_token(cls, user_id: int) -> str:
        """
        Create a new password reset token for a user
        
        Args:
            user_id: ID of the user
            
        Returns:
            The plain text token (to be sent via email)
        """
        token = cls.generate_token()
        hashed_token = cls.hash_token(token)
        expires_at = datetime.utcnow() + timedelta(hours=cls.TOKEN_EXPIRY_HOURS)
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            try:
                # Invalidate any existing tokens for this user
                cursor.execute(
                    "DELETE FROM password_reset_tokens WHERE user_id = ?",
                    (user_id,)
                )
                
                # Create new token
                cursor.execute(
                    """INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                       VALUES (?, ?, ?)""",
                    (user_id, hashed_token, expires_at)
                )
                
                conn.commit()
                logger.info(f"Created password reset token for user {user_id}")
                
                return token
                
            except Exception as e:
                logger.error(f"Failed to create password reset token: {str(e)}")
                raise
    
    @classmethod
    def verify_token(cls, token: str) -> Optional[int]:
        """
        Verify a password reset token
        
        Args:
            token: The plain text token
            
        Returns:
            User ID if token is valid, None otherwise
        """
        hashed_token = cls.hash_token(token)
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            try:
                cursor.execute(
                    """SELECT user_id FROM password_reset_tokens
                       WHERE token_hash = ? AND expires_at > ? AND used = FALSE""",
                    (hashed_token, datetime.utcnow())
                )
                
                result = cursor.fetchone()
                
                if result:
                    user_id = result[0]
                    logger.info(f"Verified password reset token for user {user_id}")
                    return user_id
                else:
                    logger.warning("Invalid or expired password reset token")
                    return None
                    
            except Exception as e:
                logger.error(f"Failed to verify password reset token: {str(e)}")
                return None
    
    @classmethod
    def invalidate_token(cls, token: str) -> bool:
        """
        Mark a token as used (invalidate it)
        
        Args:
            token: The plain text token
            
        Returns:
            True if token was invalidated successfully
        """
        hashed_token = cls.hash_token(token)
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with get_db() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "UPDATE password_reset_tokens SET used = TRUE WHERE token_hash = ?",
                        (hashed_token,)
                    )
                    
                    conn.commit()
                    return cursor.rowcount > 0
                    
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Token invalidation failed (attempt {attempt + 1}/{max_retries}): {str(e)}. Retrying...")
                    import time
                    time.sleep(0.5 * (attempt + 1))  # Exponential backoff
                else:
                    logger.error(f"Failed to invalidate token after {max_retries} attempts: {str(e)}")
                    return False
        
        return False
    
    @classmethod
    def cleanup_expired_tokens(cls) -> int:
        """
        Remove expired tokens from database
        
        Returns:
            Number of tokens removed
        """
        with get_db() as conn:
            cursor = conn.cursor()
            
            try:
                cursor.execute(
                    "DELETE FROM password_reset_tokens WHERE expires_at < ?",
                    (datetime.utcnow(),)
                )
                
                deleted_count = cursor.rowcount
                conn.commit()
                
                logger.info(f"Cleaned up {deleted_count} expired password reset tokens")
                return deleted_count
                
            except Exception as e:
                logger.error(f"Failed to cleanup expired tokens: {str(e)}")
                return 0


password_reset_token_service = PasswordResetTokenService()

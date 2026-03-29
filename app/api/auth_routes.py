"""
app/api/auth_routes.py
───────────────────────
JWT authentication endpoints.
  POST /api/v2/auth/register  — Create a new user account
  POST /api/v2/auth/login     — Obtain a JWT access token
  GET  /api/v2/auth/me        — Get current user info
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import logging

logger = logging.getLogger(__name__)

from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.database import create_user, get_user, get_user_by_email, get_db
from app.services.token_service import password_reset_token_service
from app.services.email_service import email_service

router = APIRouter(prefix="/api/v2/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., description="User's email address")
    password: str = Field(..., min_length=6)
    role: str = Field("analyst", description="admin | analyst | viewer")


class LoginRequest(BaseModel):
    username: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., description="User's email address")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Password reset token")
    new_password: str = Field(..., min_length=6, description="New password")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


@router.post("/register", status_code=status.HTTP_201_CREATED, summary="Register a new user")
async def register(body: RegisterRequest) -> dict:
    if body.role not in ("admin", "analyst", "viewer"):
        raise HTTPException(400, "Role must be one of: admin, analyst, viewer")
    
    # Validate email format
    if not body.email or '@' not in body.email:
        raise HTTPException(400, "Invalid email address")
    
    # Check if username already exists
    existing_user = get_user(body.username)
    if existing_user:
        raise HTTPException(409, f"Username '{body.username}' is already taken.")
    
    # Check if email already exists
    existing_email = get_user_by_email(body.email)
    if existing_email:
        raise HTTPException(409, f"Email '{body.email}' is already registered.")
    
    ok = create_user(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
        email=body.email
    )
    
    if not ok:
        raise HTTPException(409, f"Username '{body.username}' is already taken.")
    
    return {"message": f"User '{body.username}' created with role '{body.role}'."}


@router.post("/login", response_model=TokenResponse, summary="Login and obtain JWT token")
async def login(body: LoginRequest) -> TokenResponse:
    logger.info(f"🔐 LOGIN ATTEMPT: username={body.username}")
    
    user = get_user(body.username)
    
    if not user:
        logger.error(f"❌ User '{body.username}' NOT FOUND")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.info(f"✅ User found: {user['username']} (ID: {user['id']})")
    
    password_valid = verify_password(body.password, user["password_hash"])
    logger.info(f"Password verification: {'SUCCESS' if password_valid else 'FAILED'}")
    
    if not password_valid:
        logger.error(f"❌ Wrong password for user '{body.username}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = create_access_token(user["username"], user["role"])
    logger.info(f"✅ Login successful for user '{body.username}'")
    
    return TokenResponse(
        access_token=token,
        role=user["role"],
        username=user["username"],
    )


@router.get("/me", summary="Get current user info")
async def me(current_user: dict = Depends(get_current_user)) -> dict:
    return {
        "username": current_user.get("sub"),
        "role": current_user.get("role"),
    }


@router.post("/forgot-password", status_code=status.HTTP_200_OK, summary="Request password reset email")
async def forgot_password(body: ForgotPasswordRequest) -> dict:
    """
    Send a password reset email to the user.
    
    - **email**: User's email address
    - Returns: Success message if email was sent (or if email doesn't exist, for security)
    """
    try:
        logger.info(f"FORGOT PASSWORD REQUEST: {body.email}")
        print(f"📧 FORGOT PASSWORD REQUEST: {body.email}")  # Force print to console
        
        # Get user by email
        user = get_user_by_email(body.email)
        logger.info(f"User lookup result: {'FOUND' if user else 'NOT FOUND'}")
        
        if not user:
            logger.warning(f"No user found with email: {body.email}")
            # Don't reveal if email exists or not (security best practice)
            return {"message": "If that email exists in our system, you'll receive a password reset link shortly."}
        
        # Create reset token
        reset_token = password_reset_token_service.create_token(user["id"])
        logger.info(f"Created password reset token for user {user['username']}")
        
        # Use the actual username from database (user's given name)
        user_given_name = user["username"]
            
        # Send email
        logger.info(f"Attempting to send email to {body.email}")
        email_sent = await email_service.send_password_reset_email(
            to_email=body.email,
            username=user_given_name,
            reset_token=reset_token
        )
        
        if email_sent:
            logger.info(f"✅ Password reset email sent successfully to {body.email}")
        else:
            logger.error(f"❌ Failed to send password reset email to {body.email}")
            # Still return success to avoid revealing email existence
        
        return {"message": "If that email exists in our system, you'll receive a password reset link shortly."}
        
    except Exception as e:
        logger.error(f"💥 ERROR in forgot_password: {str(e)}", exc_info=True)
        print(f"💥 ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        raise  # Re-raise so we see the error


@router.post("/reset-password", status_code=status.HTTP_200_OK, summary="Reset password with token")
async def reset_password(body: ResetPasswordRequest) -> dict:
    """
    Reset password using a valid token.
    
    - **token**: Password reset token from email
    - **new_password**: New password (min 6 characters)
    - Returns: Success message
    """
    import hashlib
    
    logger.info(f"📝 RESET PASSWORD REQUEST received")
    logger.info(f"Token: {body.token[:30]}...")
    
    # Verify token
    user_id = password_reset_token_service.verify_token(body.token)
    logger.info(f"Token verification result: {'SUCCESS - User ID: ' + str(user_id) if user_id else 'FAILED'}")
    
    if not user_id:
        logger.error("❌ Token verification failed - invalid or expired")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token."
        )
    
    # Get user info
    with get_db() as conn:
        cursor = conn.cursor()
        
        try:
            logger.info(f"Resetting password for user ID {user_id}")
            
            # Hash new password
            hashed_password = hash_password(body.new_password)
            
            # Update password
            cursor.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (hashed_password, user_id)
            )
            
            if cursor.rowcount == 0:
                logger.error(f"No user found with ID {user_id}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update password."
                )
            
            logger.info(f"Password updated in database. Invalidating token...")
            
            # Invalidate the token
            token_invalidated = password_reset_token_service.invalidate_token(body.token)
            logger.info(f"Token invalidation result: {'SUCCESS' if token_invalidated else 'FAILED'}")
            
            conn.commit()
            
            logger.info(f"✅ Password reset successful for user ID {user_id}")
            
            return {"message": "Your password has been reset successfully. You can now log in with your new password."}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to reset password: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while resetting your password."
            )

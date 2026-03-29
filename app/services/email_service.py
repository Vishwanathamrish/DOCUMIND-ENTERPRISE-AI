"""
Email service for sending password reset emails and other notifications.
Supports multiple providers: SMTP, SendGrid, Resend
"""

import smtplib
import os
from pathlib import Path
from dotenv import load_dotenv
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Load .env file explicitly
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class EmailService:
    """Service for sending emails"""
    
    def __init__(self):
        # Email provider configuration
        self.provider = os.getenv("EMAIL_PROVIDER", "smtp")  # smtp, sendgrid, resend
        self.from_email = os.getenv("FROM_EMAIL", "noreply@documind.com")
        self.from_name = os.getenv("FROM_NAME", "DocuMind AI")
        
        # SMTP configuration
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        
        # SendGrid configuration
        self.sendgrid_api_key = os.getenv("SENDGRID_API_KEY", "")
        
        # Resend configuration
        self.resend_api_key = os.getenv("RESEND_API_KEY", "")
    
    async def send_password_reset_email(self, to_email: str, username: str, reset_token: str) -> bool:
        """
        Send password reset email to user
        
        Args:
            to_email: Recipient email address
            username: Username of the recipient
            reset_token: Password reset token
            
        Returns:
            True if email was sent successfully, False otherwise
        """
        reset_link = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token={reset_token}"
        
        subject = "Reset Your DocuMind Password"
        
        # HTML email body
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    line-height: 1.6;
                    color: #1a1a1a;
                    background-color: #f5f5f5;
                    margin: 0;
                    padding: 0;
                }}
                .container {{
                    max-width: 600px;
                    margin: 40px auto;
                    background: #ffffff;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    background: linear-gradient(135deg, #FFC107, #FF8C00);
                    padding: 32px;
                    text-align: center;
                }}
                .logo {{
                    width: 56px;
                    height: 56px;
                    background: #fff;
                    border-radius: 12px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    font-weight: bold;
                    color: #0F0F10;
                }}
                .content {{
                    padding: 40px 32px;
                }}
                h1 {{
                    margin: 0 0 16px 0;
                    color: #1a1a1a;
                    font-size: 24px;
                }}
                p {{
                    margin: 0 0 24px 0;
                    color: #666;
                    font-size: 16px;
                }}
                .button {{
                    display: inline-block;
                    background: linear-gradient(135deg, #FFC107, #FF8C00);
                    color: #000;
                    text-decoration: none;
                    padding: 14px 32px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    margin: 24px 0;
                }}
                .link {{
                    color: #FFC107;
                    text-decoration: none;
                    word-break: break-all;
                }}
                .footer {{
                    background: #f9fafb;
                    padding: 24px 32px;
                    text-align: center;
                    color: #999;
                    font-size: 14px;
                    border-top: 1px solid #e5e7eb;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">⚡</div>
                </div>
                <div class="content">
                    <h1>Forgot your password?</h1>
                    <p>Hi {username},</p>
                    <p>No worries! We've received a request to reset your password for your DocuMind account.</p>
                    <p>Click the button below to reset your password:</p>
                    <a href="{reset_link}" class="button">Reset Password</a>
                    <p>Or copy and paste this link into your browser:</p>
                    <p><a href="{reset_link}" class="link">{reset_link}</a></p>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                </div>
                <div class="footer">
                    <p>© 2024 DocuMind AI. All rights reserved.</p>
                    <p>This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        text_body = f"""
        Hi {username},
        
        Forgot your password?
        
        We've received a request to reset your password for your DocuMind account.
        
        Reset your password using this link:
        {reset_link}
        
        This link will expire in 1 hour.
        
        If you didn't request this password reset, you can safely ignore this email.
        Your password will remain unchanged.
        
        © 2024 DocuMind AI. All rights reserved.
        """
        
        try:
            if self.provider == "smtp":
                return await self._send_smtp_email(to_email, subject, text_body, html_body)
            elif self.provider == "sendgrid":
                return await self._send_sendgrid_email(to_email, subject, text_body, html_body)
            elif self.provider == "resend":
                return await self._send_resend_email(to_email, subject, text_body, html_body)
            else:
                logger.error(f"Unknown email provider: {self.provider}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to send password reset email: {str(e)}")
            return False
    
    async def _send_smtp_email(self, to_email: str, subject: str, text_body: str, html_body: str) -> bool:
        """Send email using SMTP"""
        if not self.smtp_user or not self.smtp_password:
            logger.error("SMTP credentials not configured")
            return False
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = to_email
        
        part1 = MIMEText(text_body, "plain")
        part2 = MIMEText(html_body, "html")
        
        msg.attach(part1)
        msg.attach(part2)
        
        try:
            server = smtplib.SMTP(self.smtp_host, self.smtp_port)
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.sendmail(self.from_email, to_email, msg.as_string())
            server.quit()
            
            logger.info(f"Password reset email sent to {to_email}")
            return True
        except Exception as e:
            logger.error(f"SMTP error: {str(e)}")
            return False
    
    async def _send_sendgrid_email(self, to_email: str, subject: str, text_body: str, html_body: str) -> bool:
        """Send email using SendGrid API"""
        if not self.sendgrid_api_key:
            logger.error("SendGrid API key not configured")
            return False
        
        try:
            import sendgrid
            from sendgrid.helpers.mail import Mail
            
            sg = sendgrid.SendGridAPIClient(api_key=self.sendgrid_api_key)
            
            message = Mail(
                from_email=f"{self.from_name} <{self.from_email}>",
                to_emails=to_email,
                subject=subject,
                plain_text_content=text_body,
                html_content=html_body
            )
            
            response = sg.send(message)
            logger.info(f"SendGrid email sent to {to_email}, status: {response.status_code}")
            return response.status_code == 202
            
        except Exception as e:
            logger.error(f"SendGrid error: {str(e)}")
            return False
    
    async def _send_resend_email(self, to_email: str, subject: str, text_body: str, html_body: str) -> bool:
        """Send email using Resend API"""
        if not self.resend_api_key:
            logger.error("Resend API key not configured")
            return False
        
        try:
            import requests
            
            headers = {
                "Authorization": f"Bearer {self.resend_api_key}",
                "Content-Type": "application/json"
            }
            
            data = {
                "from": f"{self.from_name} <{self.from_email}>",
                "to": to_email,
                "subject": subject,
                "text": text_body,
                "html": html_body
            }
            
            response = requests.post(
                "https://api.resend.com/emails",
                headers=headers,
                json=data
            )
            
            result = response.json()
            logger.info(f"Resend email sent to {to_email}, ID: {result.get('id')}")
            return response.status_code == 200
            
        except Exception as e:
            logger.error(f"Resend error: {str(e)}")
            return False


# Global instance
email_service = EmailService()

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime

from app.core.config import get_settings
from app.shared.utils import setup_logger
from app.modules.users.models import User

settings = get_settings()
logger = setup_logger(__name__)


def send_email(to: str, subject: str, body: str) -> bool:
    """
    Send email using SMTP Gmail.

    Args:
        to: Recipient email address
        subject: Email subject
        body: Email body (HTML supported)

    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not settings.SMTP_EMAIL or not settings.SMTP_PASSWORD:
        logger.error("SMTP credentials not configured")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_EMAIL}>"
        msg["To"] = to
        msg["Subject"] = subject

        html_part = MIMEText(body, "html")
        msg.attach(html_part)

        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Email sent successfully to {to}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to}: {str(e)}")
        return False


def send_verification_email(
    user: User, token: str, base_url: str = "http://localhost:3000"
) -> bool:
    """
    Send email verification link to user.

    Args:
        user: User object
        token: Verification token
        base_url: Frontend base URL

    Returns:
        bool: True if sent successfully
    """
    verification_link = f"{base_url}/verify-email?token={token}"

    subject = "Verify Your Email Address"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4CAF50;">Welcome to {settings.SMTP_FROM_NAME}!</h2>
                <p>Hello <strong>{user.username}</strong>,</p>
                <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_link}" 
                       style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Verify Email Address
                    </a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">{verification_link}</p>
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                    If you didn't create an account, please ignore this email.
                </p>
            </div>
        </body>
    </html>
    """

    return send_email(user.email, subject, body)


def send_update_notification(user: User, changes: dict) -> bool:
    """
    Send notification email when user profile is updated.

    Args:
        user: User object
        changes: Dictionary of changed fields

    Returns:
        bool: True if sent successfully
    """
    changes_list = "<ul>"
    for field, value in changes.items():
        changes_list += f"<li><strong>{field.replace('_', ' ').title()}:</strong> {value}</li>"
    changes_list += "</ul>"

    subject = "Your Account Information Has Been Updated"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2196F3;">Account Update Notification</h2>
                <p>Hello <strong>{user.username}</strong>,</p>
                <p>Your account information has been updated by an administrator:</p>
                {changes_list}
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                    If you didn't request these changes, please contact support immediately.
                </p>
            </div>
        </body>
    </html>
    """

    return send_email(user.email, subject, body)


def send_password_reset_by_admin(user: User, temp_password: str) -> bool:
    """
    Send temporary password email when admin resets user password.

    Args:
        user: User object
        temp_password: Temporary password

    Returns:
        bool: True if sent successfully
    """
    subject = "Your Password Has Been Reset"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #FF9800;">Password Reset Notification</h2>
                <p>Hello <strong>{user.username}</strong>,</p>
                <p>Your password has been reset by an administrator.</p>
                <p>Your temporary password is:</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; 
                            font-family: monospace; font-size: 18px; text-align: center; margin: 20px 0;">
                    <strong>{temp_password}</strong>
                </div>
                <p style="color: #d32f2f;">
                    <strong>Important:</strong> Please change this password immediately after logging in.
                </p>
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                    If you didn't request a password reset, please contact support immediately.
                </p>
            </div>
        </body>
    </html>
    """

    return send_email(user.email, subject, body)


def send_password_reset_link_email(user: User, reset_link: str) -> bool:
    """
    Send password reset link to user.
    """
    subject = "Lấy lại mật khẩu tài khoản của bạn"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4CAF50;">Yêu cầu khôi phục mật khẩu</h2>
                <p>Xin chào <strong>{user.username}</strong>,</p>
                <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn. Vui lòng bấm vào nút bên dưới để thiết lập mật khẩu mới:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" 
                       style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Đặt lại mật khẩu
                    </a>
                </div>
                <p>Hoặc sao chép và dán liên kết này vào trình duyệt của bạn:</p>
                <p style="word-break: break-all; color: #666;">{reset_link}</p>
                <p style="margin-top: 30px; color: #d32f2f; font-size: 14px;">
                    <strong>Lưu ý:</strong> Liên kết này chỉ có hiệu lực trong vòng 15 phút.
                </p>
                <p style="margin-top: 10px; color: #666; font-size: 12px;">
                    Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.
                </p>
            </div>
        </body>
    </html>
    """
    return send_email(user.email, subject, body)


def send_password_changed_notification_email(user: User) -> bool:
    """
    Send notification email when user changes password successfully.
    """
    subject = "Mật khẩu của bạn đã được thay đổi"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #FF9800;">Thông báo thay đổi mật khẩu</h2>
                <p>Xin chào <strong>{user.username}</strong>,</p>
                <p>Mật khẩu tài khoản của bạn trên hệ thống vừa được thay đổi thành công.</p>
                <p style="margin-top: 30px; color: #d32f2f; font-size: 14px;">
                    <strong>Lưu ý quan trọng:</strong> Nếu bạn <strong>không</strong> thực hiện thay đổi này, tài khoản của bạn có thể đã bị kẻ gian xâm nhập. Vui lòng sử dụng tính năng "Quên mật khẩu" để lấy lại quyền truy cập hoặc liên hệ với Quản trị viên ngay lập tức.
                </p>
            </div>
        </body>
    </html>
    """
    return send_email(user.email, subject, body)


def send_account_locked_email(
    user: User,
    duration_hours: int,
    reason: str = "Vi phạm chính sách bảo mật / Hoạt động bất thường",
    detailed_reason: str = None,
) -> bool:
    """
    Send email notification when account is locked.
    """
    system_name = "Japanese Audio"
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    reference_id = f"LCK-{user.id}-{int(datetime.utcnow().timestamp())}"

    detailed_en = f"<br>Detailed Info: {detailed_reason}" if detailed_reason else ""
    detailed_vi = f"<br>Mô tả chi tiết: {detailed_reason}" if detailed_reason else ""

    subject = "[Japanese Audio] Thông báo về việc tạm ngưng hoạt động tài khoản - Account Suspension Notice"

    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <!-- Tiếng Anh -->
                <p>Dear <strong>{user.username}</strong>,</p>
                <p>This notification is sent from the {system_name} System Administration.</p>
                <p>Based on our regular compliance monitoring, we regret to inform you that your account has been temporarily suspended by an Administrator.</p>
                
                <h3 style="color: #d32f2f;">1. Status Details:</h3>
                <ul>
                    <li><strong>Reference ID:</strong> #{reference_id}</li>
                    <li><strong>Execution Time:</strong> {timestamp} (System Time)</li>
                    <li><strong>Status:</strong> Suspended</li>
                    <li><strong>Reason:</strong> {reason}{detailed_en}</li>
                </ul>

                <h3 style="color: #d32f2f;">2. Restrictions Applied:</h3>
                <p>From this moment, the following features will be temporarily disabled until further notice:</p>
                <ul>
                    <li>Login to the system and personal Dashboard.</li>
                    <li>Using the AI tool to generate listening tests from uploaded files.</li>
                    <li>Accessing lesson data and practice history.</li>
                </ul>

                <h3 style="color: #1976D2;">3. Support and Review Process:</h3>
                <p>We understand that unintended mistakes may occur. If you believe this is an error or wish to provide additional information for verification:</p>
                <ul>
                    <li>Please reply directly to this email or submit a request at the Customer Support Portal.</li>
                    <li>Provide relevant information regarding your recent activities on the system.</li>
                </ul>
                <p>Our Internal Compliance team will review and respond within 48 business hours.</p>
                
                <p style="background-color: #fce4e4; padding: 10px; border-left: 4px solid #d32f2f;">
                    <strong>Note:</strong> If no satisfactory response is received within 30 days, your account may be transitioned to a Permanently Disabled status per our Terms of Service.
                </p>

                <p>We apologize for this disruption and hope to hear from you soon to ensure a safe learning environment for the community.</p>
                <p>Sincerely,<br>
                <strong>Operations & Compliance Department</strong><br>
                {system_name} Global</p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">

                <!-- Tiếng Việt -->
                <p>Kính gửi Quý người dùng <strong>{user.username}</strong>,</p>
                <p>Chúng tôi gửi thông báo này từ bộ phận Quản trị hệ thống của {system_name}.</p>
                <p>Dựa trên quá trình kiểm soát hoạt động định kỳ, chúng tôi rất tiếc phải thông báo rằng tài khoản của bạn hiện đã bị tạm khóa bởi Quản trị viên.</p>
                
                <h3 style="color: #d32f2f;">1. Chi tiết trạng thái:</h3>
                <ul>
                    <li><strong>Mã số tham chiếu:</strong> #{reference_id}</li>
                    <li><strong>Thời điểm thực thi:</strong> {timestamp} (Giờ hệ thống)</li>
                    <li><strong>Trạng thái:</strong> Tạm khóa quyền truy cập (Suspended)</li>
                    <li><strong>Lý do:</strong> {reason}{detailed_vi}</li>
                </ul>

                <h3 style="color: #d32f2f;">2. Các hạn chế áp dụng:</h3>
                <p>Kể từ thời điểm này, các tính năng sau sẽ bị tạm ngừng cho đến khi có thông báo mới:</p>
                <ul>
                    <li>Đăng nhập vào hệ thống và Dashboard cá nhân.</li>
                    <li>Sử dụng công cụ AI tạo đề nghe từ file upload.</li>
                    <li>Truy cập dữ liệu bài học và lịch sử luyện tập.</li>
                </ul>

                <h3 style="color: #1976D2;">3. Quy trình hỗ trợ và xem xét:</h3>
                <p>Chúng tôi hiểu rằng có thể có những nhầm lẫn ngoài ý muốn. Nếu bạn tin rằng đây là một sai sót hoặc muốn cung cấp thêm thông tin để xác minh:</p>
                <ul>
                    <li>Vui lòng phản hồi trực tiếp email này hoặc gửi yêu cầu tại Cổng Hỗ Trợ Khách Hàng.</li>
                    <li>Cung cấp các thông tin liên quan đến hoạt động gần nhất của bạn trên hệ thống.</li>
                </ul>
                <p>Đội ngũ Kiểm soát Nội bộ sẽ xem xét và phản hồi kết quả giải quyết trong vòng 48 giờ làm việc.</p>
                
                <p style="background-color: #fce4e4; padding: 10px; border-left: 4px solid #d32f2f;">
                    <strong>Lưu ý:</strong> Nếu không có phản hồi thỏa đáng sau 30 ngày, tài khoản có thể bị chuyển sang trạng thái Vô hiệu hóa vĩnh viễn theo Điều khoản dịch vụ.
                </p>

                <p>Chúng tôi rất tiếc về sự gián đoạn này và hy vọng sớm nhận được phản hồi từ bạn để đảm bảo môi trường học tập an toàn cho cộng đồng.</p>
                <p>Trân trọng,<br>
                <strong>Phòng Vận hành & Tuân thủ (Operations & Compliance Department)</strong><br>
                {system_name} Global</p>
            </div>
        </body>
    </html>
    """

    return send_email(user.email, subject, body)


def send_account_unlocked_email(user: User) -> bool:
    """
    Send email notification when account is unlocked.
    """
    system_name = "Japanese Audio"
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    reference_id = f"LCK-{user.id}-{int(datetime.utcnow().timestamp())}"

    subject = "[Japanese Audio] Thông báo khôi phục hoạt động tài khoản - Account Restored Notice"

    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <!-- Tiếng Anh -->
                <p>Dear <strong>{user.username}</strong>,</p>
                <p>This notification is sent from the {system_name} System Administration.</p>
                <p>We are pleased to inform you that the suspension on your account has been lifted by an Administrator.</p>
                
                <h3 style="color: #388E3C;">1. Status Details:</h3>
                <ul>
                    <li><strong>Reference ID:</strong> #{reference_id}</li>
                    <li><strong>Execution Time:</strong> {timestamp} (System Time)</li>
                    <li><strong>Status:</strong> Active (Restored)</li>
                </ul>

                <h3 style="color: #388E3C;">2. Access Restored:</h3>
                <p>All previously restricted features, including login, AI test generation, and lesson data access, have been fully restored. You may now resume your normal activities on the system.</p>

                <p>We appreciate your cooperation and patience during the review process. Please ensure compliance with our guidelines moving forward to maintain a safe learning environment.</p>
                
                <p>Sincerely,<br>
                <strong>Operations & Compliance Department</strong><br>
                {system_name} Global</p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">

                <!-- Tiếng Việt -->
                <p>Kính gửi Quý người dùng <strong>{user.username}</strong>,</p>
                <p>Chúng tôi gửi thông báo này từ bộ phận Quản trị hệ thống của {system_name}.</p>
                <p>Chúng tôi rất vui mừng thông báo rằng trạng thái tạm khóa trên tài khoản của bạn đã được Quản trị viên gỡ bỏ.</p>
                
                <h3 style="color: #388E3C;">1. Chi tiết trạng thái:</h3>
                <ul>
                    <li><strong>Mã số tham chiếu:</strong> #{reference_id}</li>
                    <li><strong>Thời điểm thực thi:</strong> {timestamp} (Giờ hệ thống)</li>
                    <li><strong>Trạng thái:</strong> Hoạt động bình thường (Đã khôi phục)</li>
                </ul>

                <h3 style="color: #388E3C;">2. Quyền truy cập được khôi phục:</h3>
                <p>Tất cả các tính năng bị hạn chế trước đó, bao gồm đăng nhập, sử dụng AI tạo đề thi, và truy cập dữ liệu bài học, đã được khôi phục hoàn toàn. Bạn có thể tiếp tục các hoạt động bình thường trên hệ thống.</p>

                <p>Chúng tôi đánh giá cao sự hợp tác và kiên nhẫn của bạn trong quá trình xem xét. Vui lòng tuân thủ các quy định của chúng tôi trong thời gian tới để duy trì môi trường học tập an toàn.</p>

                <p>Trân trọng,<br>
                <strong>Phòng Vận hành & Tuân thủ (Operations & Compliance Department)</strong><br>
                {system_name} Global</p>
            </div>
        </body>
    </html>
    """

    return send_email(user.email, subject, body)

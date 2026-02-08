from fastapi import HTTPException, status


class UserAlreadyExistsException(HTTPException):
    """Raised when attempting to create a user that already exists."""
    
    def __init__(self, detail: str = "User already exists"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class InvalidCredentialsException(HTTPException):
    """Raised when login credentials are invalid."""
    
    def __init__(self, detail: str = "Incorrect email or password"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )


class InvalidResetTokenException(HTTPException):
    """Raised when password reset token is invalid or expired."""
    
    def __init__(self, detail: str = "Invalid or expired reset token"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class UserNotFoundException(HTTPException):
    """Raised when a user is not found."""
    
    def __init__(self, detail: str = "User not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )

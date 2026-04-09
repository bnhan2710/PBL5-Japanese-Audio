import { Button } from '@/components/ui/Button'

interface GoogleAuthButtonProps {
  disabled?: boolean
  label: string
  onClick: () => void
}

export function GoogleAuthButton({ disabled, label, onClick }: GoogleAuthButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={disabled}
      onClick={onClick}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.4-.2-2.1H12Z"
        />
        <path
          fill="#34A853"
          d="M12 21c2.6 0 4.8-.9 6.4-2.5l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.4-4l-3.2 2.5C5 18.8 8.2 21 12 21Z"
        />
        <path
          fill="#4A90E2"
          d="M6.6 13c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2L3.4 6.5C2.5 8 2 9.4 2 11s.5 3 1.4 4.5L6.6 13Z"
        />
        <path
          fill="#FBBC05"
          d="M12 5.1c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.8 2.1 14.6 1 12 1 8.2 1 5 3.2 3.4 6.5L6.6 9C7.4 6.8 9.5 5.1 12 5.1Z"
        />
      </svg>
      {label}
    </Button>
  )
}

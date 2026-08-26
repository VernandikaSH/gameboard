'use client'

import { useRouter } from 'next/navigation'
import { FiArrowLeft } from 'react-icons/fi'

interface BackButtonProps {
  href?: string
  onClick?: () => void
  className?: string
  iconClassName?: string
  text?: string
  variant?: 'default' | 'minimal' | 'floating'
}

export default function BackButton({
  href = '/',
  onClick,
  className = '',
  iconClassName = '',
  text = 'Back',
  variant = 'default'
}: BackButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (href) {
      router.push(href)
    } else {
      router.back()
    }
  }

  const baseClasses = `flex items-center gap-2 transition-colors ${
    variant === 'floating' 
      ? 'fixed top-4 left-4 bg-gray-800 p-2 rounded-full shadow-lg z-50 text-white text-xl hover:bg-gray-300 hover:text-gray-800'
      : variant === 'minimal'
      ? 'text-gray-600 hover:text-gray-900'
      : 'text-blue-600 hover:text-blue-800'
  }`

  return (
    <button
      onClick={handleClick}
      className={`${baseClasses} ${className}`}
      aria-label={text}
    >
      <FiArrowLeft className={`w-8 h-8 ${iconClassName}`} />
      {variant !== 'minimal' && variant !== 'floating' && (
        <span>{text}</span>
      )}
    </button>
  )
}
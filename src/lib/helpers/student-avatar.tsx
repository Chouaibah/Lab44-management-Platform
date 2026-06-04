import { getInitials, getAvatarColor } from './formatting';

export function StudentAvatar({
  firstName,
  lastName,
  size = 'md',
  className = '',
}: {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const name = `${firstName} ${lastName}`;
  const initials = getInitials(firstName, lastName);
  const color = getAvatarColor(name);
  const sizeClasses = {
    sm: 'h-6 w-6 text-[9px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
    xl: 'h-14 w-14 text-lg',
  };
  return (
    <div
      className={`flex items-center justify-center rounded-full text-white font-bold shrink-0 ${color} ${sizeClasses[size]} ${className}`}
    >
      {initials}
    </div>
  );
}
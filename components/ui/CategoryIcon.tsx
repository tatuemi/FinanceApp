import React from 'react';
import {
  Wallet,
  Briefcase,
  Laptop,
  PlusCircle,
  Utensils,
  Car,
  Zap,
  GraduationCap,
  Coffee,
  Users,
  Gamepad2,
  Home,
  HeartPulse,
  ShoppingBag,
  Plane,
  Tag,
} from 'lucide-react';

interface CategoryIconProps {
  iconName: string;
  className?: string;
}

export function CategoryIcon({ iconName, className = 'h-4 w-4' }: CategoryIconProps) {
  switch (iconName) {
    case 'briefcase':
      return <Briefcase className={className} aria-hidden="true" />;
    case 'laptop':
      return <Laptop className={className} aria-hidden="true" />;
    case 'plus-circle':
      return <PlusCircle className={className} aria-hidden="true" />;
    case 'utensils':
      return <Utensils className={className} aria-hidden="true" />;
    case 'car':
      return <Car className={className} aria-hidden="true" />;
    case 'zap':
      return <Zap className={className} aria-hidden="true" />;
    case 'graduation-cap':
      return <GraduationCap className={className} aria-hidden="true" />;
    case 'coffee':
      return <Coffee className={className} aria-hidden="true" />;
    case 'users':
      return <Users className={className} aria-hidden="true" />;
    case 'gamepad-2':
      return <Gamepad2 className={className} aria-hidden="true" />;
    case 'home':
      return <Home className={className} aria-hidden="true" />;
    case 'heart-pulse':
      return <HeartPulse className={className} aria-hidden="true" />;
    case 'shopping-bag':
      return <ShoppingBag className={className} aria-hidden="true" />;
    case 'plane':
      return <Plane className={className} aria-hidden="true" />;
    case 'tag':
      return <Tag className={className} aria-hidden="true" />;
    case 'wallet':
    default:
      return <Wallet className={className} aria-hidden="true" />;
  }
}

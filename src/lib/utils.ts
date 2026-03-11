import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Tailwind CSS 类名合并工具函数
 * 用于合并 Tailwind 类名，正确处理冲突的样式
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

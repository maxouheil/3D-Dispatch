import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Check if a status is considered "backlog"
 * Backlog = new + pending
 */
export function isBacklogStatus(status: string): boolean {
  const statusLower = status.toLowerCase().trim();
  if (statusLower === '' || statusLower === 'new') return true;
  return statusLower === 'pending';
}

/**
 * Check if a status is considered "ongoing"
 * Ongoing = transmitted to 3D artist
 */
export function isOngoingStatus(status: string): boolean {
  const statusLower = status.toLowerCase().trim();
  // "transmitted to artist" ou variantes → ongoing
  return statusLower.includes('transmitted to artist') ||
         statusLower.includes('transmitted to 3d artist') ||
         statusLower.includes('transmis à l\'artiste') ||
         statusLower.includes('transmis à artiste') ||
         (statusLower.includes('transmitted') && statusLower.includes('artist'));
}

/**
 * Check if a status is considered "sent"
 * Sent = "sent to client" only
 */
export function isSentStatus(status: string): boolean {
  const statusLower = status.toLowerCase().trim();
  return statusLower === 'sent to client' || statusLower.includes('sent to client');
}

/**
 * Check if a date is within the last 7 rolling days
 */
export function isWithinLast7Days(dateString: string): boolean {
  const requestDate = new Date(dateString);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return requestDate >= sevenDaysAgo;
}

/**
 * Get the start of the current week (Monday) at 00:00:00 UTC
 */
function getStartOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  
  // Create date in local timezone, then convert to UTC
  const mondayLocal = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
  
  // Return as UTC date (normalized to start of day)
  return new Date(Date.UTC(
    mondayLocal.getFullYear(),
    mondayLocal.getMonth(),
    mondayLocal.getDate(),
    0, 0, 0, 0
  ));
}

/**
 * Get the end of the current week (Sunday) at 23:59:59 UTC
 */
function getEndOfCurrentWeek(): Date {
  const monday = getStartOfCurrentWeek();
  // Add 6 days to get Sunday
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Check if a date is within the current week (Monday to Sunday)
 */
export function isWithinCurrentWeek(dateString: string): boolean {
  if (!dateString) return false;
  
  const requestDate = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(requestDate.getTime())) {
    return false;
  }
  
  const weekStart = getStartOfCurrentWeek();
  const weekEnd = getEndOfCurrentWeek();
  
  // Normalize request date to start of day in UTC for comparison
  const requestDateNormalized = new Date(Date.UTC(
    requestDate.getUTCFullYear(),
    requestDate.getUTCMonth(),
    requestDate.getUTCDate(),
    0, 0, 0, 0
  ));
  
  // weekStart and weekEnd are already normalized to start/end of day in UTC
  return requestDateNormalized >= weekStart && requestDateNormalized <= weekEnd;
}

/**
 * Get formatted current week range (e.g., "17 - 23 novembre")
 */
export function getCurrentWeekRange(): string {
  const monday = getStartOfCurrentWeek();
  const sunday = getEndOfCurrentWeek();
  
  // Use UTC methods to get consistent dates
  const mondayDay = monday.getUTCDate();
  const mondayMonth = monday.getUTCMonth();
  const sundayDay = sunday.getUTCDate();
  const sundayMonth = sunday.getUTCMonth();
  
  const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  
  const mondayMonthName = monthNames[mondayMonth];
  const sundayMonthName = monthNames[sundayMonth];
  
  // If same month, format as "17 - 23 novembre"
  if (mondayMonth === sundayMonth) {
    return `${mondayDay} - ${sundayDay} ${mondayMonthName}`;
  }
  
  // If different months, format as "30 novembre - 6 décembre"
  return `${mondayDay} ${mondayMonthName} - ${sundayDay} ${sundayMonthName}`;
}


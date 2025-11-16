/**
 * Validates and normalizes ISBN numbers (ISBN-10 and ISBN-13)
 */

export function isValidISBN(isbn: string): boolean {
  // Remove hyphens, spaces, and convert to uppercase
  const cleanISBN = isbn.replace(/[-\s]/g, '').toUpperCase()

  // Check if it's ISBN-10 or ISBN-13
  if (cleanISBN.length === 10) {
    return isValidISBN10(cleanISBN)
  } else if (cleanISBN.length === 13) {
    return isValidISBN13(cleanISBN)
  }

  return false
}

function isValidISBN10(isbn: string): boolean {
  // ISBN-10 should be 9 digits + check digit (0-9 or X)
  if (!/^\d{9}[\dX]$/.test(isbn)) {
    return false
  }

  // Calculate check digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(isbn[i]) * (10 - i)
  }

  // Last character (check digit)
  const checkDigit = isbn[9] === 'X' ? 10 : parseInt(isbn[9])
  sum += checkDigit

  return sum % 11 === 0
}

function isValidISBN13(isbn: string): boolean {
  // ISBN-13 should be 13 digits
  if (!/^\d{13}$/.test(isbn)) {
    return false
  }

  // Calculate check digit
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(isbn[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }

  const checkDigit = parseInt(isbn[12])
  const calculatedCheck = (10 - (sum % 10)) % 10

  return checkDigit === calculatedCheck
}

/**
 * Normalizes ISBN by removing hyphens and spaces
 */
export function normalizeISBN(isbn: string): string {
  return isbn.replace(/[-\s]/g, '').toUpperCase()
}

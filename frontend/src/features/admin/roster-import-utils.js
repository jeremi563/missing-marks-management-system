export const MAX_ROSTER_FILE_BYTES = 1024 * 1024
export const MAX_ROSTER_RECORDS = 1000

const REQUIRED_HEADERS = ['studentnumber', 'fullname', 'email']

function parseCsvRows(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  let closedQuote = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
          closedQuote = true
        }
      } else {
        if (character === '\r' && text[index + 1] === '\n') {
          field += '\n'
          index += 1
        } else {
          field += character
        }
      }
      continue
    }

    if (closedQuote && character !== ',' && character !== '\r' && character !== '\n' && !/\s/.test(character)) {
      throw new Error('The CSV contains text after a closing quote.')
    }
    if (character === '"' && !closedQuote) {
      if (field.length) throw new Error('The CSV contains a quote inside an unquoted field.')
      quoted = true
      continue
    }
    if (character === ',') {
      row.push(field)
      field = ''
      closedQuote = false
      continue
    }
    if (character === '\r' || character === '\n') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      closedQuote = false
      continue
    }
    if (!closedQuote) field += character
  }

  if (quoted) throw new Error('The CSV has an unclosed quoted field.')
  if (row.length || field || closedQuote) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, '')
}

export function parseRosterCsv(text) {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''))
  if (rows.length < 2) throw new Error('The CSV must include a header and at least one student record.')

  const headers = rows[0].map(normalizeHeader)
  const indexes = REQUIRED_HEADERS.map((header) => headers.indexOf(header))
  if (indexes.some((index) => index < 0)) {
    throw new Error('Required CSV columns are studentNumber, fullName, and email.')
  }
  if (new Set(indexes).size !== indexes.length) {
    throw new Error('The CSV contains duplicate required column names.')
  }

  const records = rows.slice(1).map((cells, index) => ({
    sourceRow: index + 2,
    studentNumber: cells[indexes[0]]?.trim() ?? '',
    fullName: cells[indexes[1]]?.trim() ?? '',
    email: cells[indexes[2]]?.trim() ?? '',
  })).filter((record) => record.studentNumber || record.fullName || record.email)
  if (!records.length) throw new Error('The CSV must include at least one student record.')
  if (records.length > MAX_ROSTER_RECORDS) {
    throw new Error(`The CSV may contain no more than ${MAX_ROSTER_RECORDS} student records.`)
  }
  return records
}

function rowIssues(record, duplicateNumbers, duplicateEmails) {
  const issues = []
  const studentNumber = record.studentNumber.trim().toUpperCase()
  const fullName = record.fullName.trim()
  const email = record.email.trim().toLowerCase()

  if (!studentNumber) issues.push('Student number is required.')
  else if (!/^[A-Z]{2}\d{2}\/\d{5}\/\d{2}$/.test(studentNumber)) issues.push('Student number must use LLCC/DDDDD/YY format.')
  else {
    const year = Number(studentNumber.slice(-2))
    if (year < 13 || year > new Date().getFullYear() % 100) issues.push('Student number has an invalid admission year.')
  }
  if (!fullName) issues.push('Full name is required.')
  else if (fullName.length > 200) issues.push('Full name must be 200 characters or fewer.')
  if (!email) issues.push('Email is required.')
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('Enter a valid email address.')
  if (studentNumber && duplicateNumbers.has(studentNumber)) issues.push('Student number is duplicated in this file.')
  if (email && duplicateEmails.has(email)) issues.push('Email is duplicated in this file.')
  return issues
}

export function validateRosterRecords(records) {
  const numberCounts = new Map()
  const emailCounts = new Map()
  records.forEach(({ studentNumber, email }) => {
    const number = studentNumber.trim().toUpperCase()
    const normalizedEmail = email.trim().toLowerCase()
    if (number) numberCounts.set(number, (numberCounts.get(number) ?? 0) + 1)
    if (normalizedEmail) emailCounts.set(normalizedEmail, (emailCounts.get(normalizedEmail) ?? 0) + 1)
  })
  const duplicateNumbers = new Set([...numberCounts].filter(([, count]) => count > 1).map(([number]) => number))
  const duplicateEmails = new Set([...emailCounts].filter(([, count]) => count > 1).map(([email]) => email))

  return records.map((record) => {
    const issues = rowIssues(record, duplicateNumbers, duplicateEmails)
    return { ...record, issues, status: issues.length ? 'INVALID' : 'VALID', serverStatus: '', serverMessage: '' }
  })
}

export function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

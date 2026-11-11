
const ERROR_MESSAGES = {
  400: 'The submitted information is invalid. Please check your input.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested information could not be found.',
  409: 'This action conflicts with the current record state. Refresh and try again.',
  422: 'The request could not be processed because of a business rule.',
  500: 'A server error occurred. Please try again later.',
  503: 'The service is temporarily unavailable. Please try again later.',
}

export function getApiErrorMessage(error) {
  if (!error.response) {
    return 'Unable to connect to the server. Check your connection and try again.'
  }

  const status = error.response.status

  return (
    error.response.data?.message ||
    ERROR_MESSAGES[status] ||
    'Something went wrong. Please try again.'
  )
}

export function getFieldErrors(error) {
  const details = error.response?.data?.details

  if (!Array.isArray(details)) {
    return {}
  }

  return details.reduce((errors, detail) => {
    if (detail.path && detail.message) {
      errors[detail.path] = detail.message
    }

    return errors
  }, {})
}
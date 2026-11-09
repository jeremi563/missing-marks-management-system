
function CharCounter({ value = '', maxLength = 2000 }) {
  const currentLength = value.length
  const isOverLimit = currentLength > maxLength

  return (
    <div
      className={`char-counter ${isOverLimit ? 'char-counter-error' : ''}`}
      aria-live="polite"
    >
      <span>
        {currentLength} / {maxLength} characters
      </span>

      {isOverLimit && (
        <span>Character limit exceeded.</span>
      )}
    </div>
  )
}

export default CharCounter
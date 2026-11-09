
function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
}) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>
        {label}

        {required && (
          <span className="required-indicator"> *</span>
        )}
      </label>

      {children}

      {hint && !error && (
        <small className="field-hint">{hint}</small>
      )}

      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  )
}

export default FormField

import { ChevronLeft, ChevronRight } from 'lucide-react'

function Pager({
  page = 1,
  totalPages = 1,
  total = 0,
  onPageChange,
}) {
  const currentPage = Math.max(1, page)
  const pageCount = Math.max(1, totalPages)

  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < pageCount

  if (total === 0) {
    return null
  }

  return (
    <div className="pager">
      <p className="pager-info">
        Page {currentPage} of {pageCount}
        <span>({total} records)</span>
      </p>

      <div className="pager-actions">
        <button
          type="button"
          className="pager-button"
          disabled={!canGoPrevious}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
          Previous
        </button>

        <button
          type="button"
          className="pager-button"
          disabled={!canGoNext}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

export default Pager
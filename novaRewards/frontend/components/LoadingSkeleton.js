export default function LoadingSkeleton() {
  return (
    <div className="skeleton-container">
      <style jsx>{`
        .skeleton-container {
          display: grid;
          grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
          gap: 1.5rem;
          align-items: start;
          margin-bottom: 1.5rem;
        }

        .skeleton-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .skeleton-line {
          height: 1rem;
          background: var(--surface-2);
          border-radius: 4px;
          margin-bottom: 0.75rem;
        }

        .skeleton-line:last-child {
          margin-bottom: 0;
        }

        .skeleton-large {
          height: 3rem;
          margin: 1rem 0;
        }

        .skeleton-table {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @media (max-width: 767px) {
          .skeleton-container {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Balance skeleton */}
      <div className="skeleton-card">
        <div className="skeleton-line" style={{ width: "60%" }}></div>
        <div className="skeleton-line skeleton-large"></div>
        <div className="skeleton-line" style={{ width: "40%" }}></div>
      </div>

      {/* Transaction history skeleton */}
      <div className="skeleton-card">
        <div className="skeleton-line" style={{ width: "50%", marginBottom: "1rem" }}></div>
        <div className="skeleton-table">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton-line"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

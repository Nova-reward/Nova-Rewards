'use client';

import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import RedemptionHistory from '../components/RedemptionHistory';
import { withAuth } from '../context/AuthContext';

function HistoryContent() {
  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <RedemptionHistory />
      </div>
    </DashboardLayout>
  );
}

function History() {
  return (
    <ErrorBoundary>
      <HistoryContent />
    </ErrorBoundary>
  );
}

export default withAuth(History);

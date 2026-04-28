import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import HelpCenterFAQ from '../components/HelpCenterFAQ';
import { withAuth } from '../context/AuthContext';

function HelpCenterContent() {
  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <HelpCenterFAQ />
      </div>
    </DashboardLayout>
  );
}

function HelpCenter() {
  return (
    <ErrorBoundary>
      <HelpCenterContent />
    </ErrorBoundary>
  );
}

export default withAuth(HelpCenter);

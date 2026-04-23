import { useEffect } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useWallet } from "../context/WalletContext";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ErrorBoundary from "../components/ErrorBoundary";

const Leaderboard = dynamic(() => import("../components/Leaderboard"), { ssr: false });

function LeaderboardPage() {
  const { publicKey, loading: walletLoading } = useWallet();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
    else if (!walletLoading && !publicKey) router.push("/");
  }, [publicKey, walletLoading, isAuthenticated, authLoading, router]);

  if (authLoading || walletLoading || !isAuthenticated || !publicKey) {
    return <LoadingSkeleton />;
  }

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <Leaderboard />
      </div>
    </DashboardLayout>
  );
}

export default function LeaderboardPageWrapper() {
  return (
    <ErrorBoundary>
      <LeaderboardPage />
    </ErrorBoundary>
  );
}

export function formatNumber(num: number, decimals: number = 2): string {
  if (isNaN(num)) return '0';
  
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(decimals) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(decimals) + 'K';
  }
  
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function truncateAddress(address: string, start = 6, end = 4): string {
  if (!address) return '';
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

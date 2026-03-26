'use client';

/**
 * Component that renders a transaction hash as a clickable link to Stellar Expert.
 * Opens in a new tab with proper accessibility attributes.
 */
export default function TransactionLink({ txHash, network = 'testnet' }) {
  if (!txHash) return null;

  const url = `https://stellar.expert/explorer/${network}/tx/${txHash}`;
  
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View transaction ${txHash} on Stellar Expert`}
    >
      {txHash}
    </a>
  );
}

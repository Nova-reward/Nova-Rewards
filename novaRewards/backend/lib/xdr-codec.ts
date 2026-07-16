import { xdr, nativeToScVal, scValToNative, Address } from 'stellar-sdk';

// ── Types ────────────────────────────────────────────────────────────────────

export type ScValPrimitive = string | number | bigint | boolean | null | Buffer;
export type ScValInput = ScValPrimitive | ScValPrimitive[] | Record<string, ScValPrimitive>;

export interface DecodedContractEvent {
  type: string;
  contractId: string;
  data: unknown;
  ledger: number;
  txHash: string;
}

// ── Encoding ─────────────────────────────────────────────────────────────────

/**
 * Encodes a named contract function's arguments to XDR ScVal array.
 * Accepts native JS values; delegates to stellar-sdk nativeToScVal.
 */
export function encodeContractArgs(
  functionName: string,
  args: ScValInput[],
): xdr.ScVal[] {
  if (!functionName) throw new Error('functionName is required');
  return args.map((arg) => {
    if (arg instanceof Buffer || (typeof arg === 'object' && arg !== null && !Array.isArray(arg))) {
      return nativeToScVal(arg);
    }
    return nativeToScVal(arg);
  });
}

// ── Decoding ─────────────────────────────────────────────────────────────────

/**
 * Decodes an XDR ScVal (base64 string or ScVal object) to a native JS value.
 */
export function decodeContractResult(xdrInput: string | xdr.ScVal): unknown {
  const scVal =
    typeof xdrInput === 'string'
      ? xdr.ScVal.fromXDR(xdrInput, 'base64')
      : xdrInput;
  return scValToNative(scVal);
}

/**
 * Parses a Horizon contract event (from getEvents / event stream) to a typed object.
 *
 * @param event - Raw Horizon event record with `type`, `contractId`, `value`, `ledger`, `txHash`
 */
export function decodeContractEvent(event: {
  type: string;
  contractId: string;
  value: { xdr: string };
  ledger: number;
  txHash: string;
}): DecodedContractEvent {
  const data = decodeContractResult(event.value.xdr);
  return {
    type: event.type,
    contractId: event.contractId,
    data,
    ledger: event.ledger,
    txHash: event.txHash,
  };
}

/**
 * Convenience: encode a Stellar address (G… or C…) as an ScVal Address.
 */
export function encodeAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

/**
 * Convenience: decode an ScVal Address to its string representation.
 */
export function decodeAddress(scVal: xdr.ScVal): string {
  return Address.fromScVal(scVal).toString();
}

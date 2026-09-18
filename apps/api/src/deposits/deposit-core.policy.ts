import { BadRequestException } from '@nestjs/common';

export type DepositExcessAction = 'CREDIT' | 'REFUND';

export interface DepositConversionPlan {
  bookingBalance: number;
  securityRequired: number;
  transferAmount: number;
  additionalCashRequired: number;
  excessAmount: number;
  excessAction: DepositExcessAction | null;
}

const money = (value: number, errorCode: string) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new BadRequestException(errorCode);
  }
  return Math.round(normalized * 100) / 100;
};

export function buildDepositConversionPlan(
  bookingBalanceInput: number,
  securityRequiredInput: number,
  excessAction?: DepositExcessAction,
): DepositConversionPlan {
  const bookingBalance = money(bookingBalanceInput, 'DEPOSIT_BOOKING_BALANCE_INVALID');
  const securityRequired = money(securityRequiredInput, 'DEPOSIT_SECURITY_REQUIRED_INVALID');
  if (securityRequired <= 0) {
    throw new BadRequestException('DEPOSIT_SECURITY_REQUIRED_INVALID');
  }

  const transferAmount = Math.min(bookingBalance, securityRequired);
  const additionalCashRequired = money(
    Math.max(securityRequired - transferAmount, 0),
    'DEPOSIT_CONVERSION_AMOUNT_INVALID',
  );
  const excessAmount = money(
    Math.max(bookingBalance - transferAmount, 0),
    'DEPOSIT_CONVERSION_AMOUNT_INVALID',
  );

  if (excessAmount > 0 && !excessAction) {
    throw new BadRequestException('DEPOSIT_EXCESS_ACTION_REQUIRED');
  }

  return {
    bookingBalance,
    securityRequired,
    transferAmount,
    additionalCashRequired,
    excessAmount,
    excessAction: excessAmount > 0 ? excessAction! : null,
  };
}

export interface DepositCancellationPlan {
  availableBalance: number;
  refundAmount: number;
  keepAmount: number;
  deductAmount: number;
}

export function buildDepositCancellationPlan(input: {
  availableBalance: number;
  refundAmount?: number;
  keepAmount?: number;
  deductAmount?: number;
}): DepositCancellationPlan {
  const availableBalance = money(input.availableBalance, 'DEPOSIT_BALANCE_INVALID');
  const refundAmount = money(input.refundAmount || 0, 'DEPOSIT_REFUND_AMOUNT_INVALID');
  const keepAmount = money(input.keepAmount || 0, 'DEPOSIT_KEEP_AMOUNT_INVALID');
  const deductAmount = money(input.deductAmount || 0, 'DEPOSIT_DEDUCT_AMOUNT_INVALID');
  const resolved = money(refundAmount + keepAmount + deductAmount, 'DEPOSIT_RESOLUTION_AMOUNT_INVALID');

  if (availableBalance <= 0) {
    throw new BadRequestException('DEPOSIT_BALANCE_EMPTY');
  }
  if (resolved !== availableBalance) {
    throw new BadRequestException('DEPOSIT_RESOLUTION_MUST_EQUAL_AVAILABLE_BALANCE');
  }

  return { availableBalance, refundAmount, keepAmount, deductAmount };
}

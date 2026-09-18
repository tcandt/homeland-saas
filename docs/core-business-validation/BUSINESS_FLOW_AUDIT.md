# Business Flow Audit

## Baseline

Expected chain: Room → reservation/hold → deposit → payment/confirmation → primary contract → occupants → activation → rental cycle → utilities → invoice/payment → month close → finance/summary/report.

Mapped implementation: `RoomPremiumModal` → deposit/contract/invoice drawers → web query/mutation adapters → Nest controllers/services → Prisma entities and ledger.

Key paths: `POST /deposits/:id/collect` → `DepositsService.collect` → `DepositCoreService.collect`; `POST /contracts/:id/activate` → `ContractsService.activateContract`; invoice payment → `InvoicesService.pay` with provider reference locking.

Difference/state: browser verification not yet complete. Financial correctness and ownership isolation remain unverified until desktop scenarios run.

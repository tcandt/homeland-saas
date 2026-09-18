# Homeland Multi-Agent Rules

## Chế độ vận hành

- Áp dụng `STRICT + TOKEN-EFFICIENT + QUALITY-GATED`.
- `docs/operations/GO_LIVE_TODO.md` là source of truth. Chỉ đọc current CORE item và context trực tiếp cần thiết.
- Root GPT-6 Astra Medium là orchestrator; không tạo orchestrator subagent và không spawn GPT-6 Astra mặc định.
- Mặc định chỉ dùng một subagent. Tối đa hai subagent hoạt động và tối đa một writer tại mọi thời điểm.
- Subagent không được spawn subagent khác. Không để hai role WRITE hoạt động đồng thời.
- Trước mỗi spawn, root phải xác nhận agent thực sự cần, task đủ độc lập, agent hiện tại không làm được và đã chọn model thấp nhất đủ năng lực.
- Routing: Luna đủ thì dùng Luna; Terra đủ thì không dùng Sol; Sol đủ thì không nâng Astra.

## Workflow

- Micro-task: root → investigator chỉ khi cần → đúng một writer → inspect accumulated diff → task kế tiếp.
- Ưu tiên CODE hơn REPORT. Không review/test đầy đủ sau từng file hoặc micro-task.
- Hoàn thành toàn bộ mục liên quan của milestone rồi mới gọi `milestone-reviewer`, sau đó `gate-tester`, sửa đúng finding đã xác nhận và chỉ chạy lại test bị ảnh hưởng.
- Các gate: `GATE-08` sau toàn bộ CORE-08; `GATE-09` sau CORE-09.01..09.06; `GATE-10` cho release regression, E2E, integration và migration verification.
- Mọi logic money/deposit/invoice/payment/refund/ledger/settlement/migration/tenant isolation/concurrency phải qua Sol High review trước khi đóng milestone.
- Một bug tối đa hai vòng fix thông thường. Sau hai vòng vẫn fail thì dừng, root đánh giá lại và chỉ gọi Sol High root-cause review nếu cần.

## Giới hạn thay đổi

- Giữ nguyên dirty working tree. Không reset, revert, clean hoặc rebase làm mất thay đổi.
- Không migration/apply production; không sửa migration lịch sử hoặc checksum.
- Writer chỉ sửa scope được giao, không redesign, không opportunistic refactor, không cleanup module khác và không tự cập nhật TODO.
- Nếu scope sai hoặc cần đổi architecture, dừng với `STATUS: BLOCKED`, evidence ngắn và next action.
- Không đọc lại toàn repository hoặc toàn bộ TODO cho mỗi task; chỉ đọc affected files, direct callers/callees, dependency và relevant diff.

## Test, review và TODO

- Không tự chạy full unit, integration, E2E, PostgreSQL concurrency hoặc full build sau từng edit.
- Focused test chỉ chạy khi logical module/high-risk transaction block hoàn tất, milestone chuẩn bị đóng hoặc root yêu cầu.
- Nếu test fail, chỉ chạy lại failed/affected tests sau fix; không chạy lại test đã pass khi code liên quan không đổi.
- Reviewer chỉ đọc, không sửa finding của chính mình và chỉ trả `PASS`, `PASS_WITH_FINDINGS` hoặc `BLOCK` với finding thực sự cần hành động.
- Chỉ cập nhật TODO khi status thực sự đổi, Definition of Done đạt kèm evidence hoặc xuất hiện blocker quan trọng. Code xong không đồng nghĩa milestone hoàn tất.

## Output subagent

- Mặc định tối đa khoảng 6 dòng: `STATUS`, `SCOPE`, `CHANGED`, `BLOCKER`, `RISK`, `NEXT`; khi lỗi có thể dùng `EVIDENCE`.
- Không nhắc lại task/TODO, không kể methodology hoặc command, không viết report dài và không lặp evidence.

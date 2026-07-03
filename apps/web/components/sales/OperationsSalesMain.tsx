"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import OperationsSalesLeadCard from "./OperationsSalesLeadCard";

const leads = [
  {
    id: "L-2401",
    name: "Nguyễn Văn A",
    phone: "0901234567",
    email: "nguyenvana@gmail.com",
    avatar: "https://i.pravatar.cc/150?u=1",
    score: 95,
    status: "Negotiating",
    hotLevel: "Hot",
    source: "Facebook",
    job: "IT Manager",
    need: "Căn hộ 1PN, ban công",
    budget: "8M - 10M",
    roomType: "1PN",
    building: "HomeLand Center",
    contactDate: "25/06/2026",
    nextFollowup: "Hôm nay, 15:00",
    viewingSchedule: "26/06, 09:30",
    salesName: "Tuấn Đạt",
    expectedRevenue: "10,000,000",
    commission: "1,500,000"
  },
  {
    id: "L-2402",
    name: "Trần Thị B",
    phone: "0987654321",
    email: "tranthib@gmail.com",
    avatar: "https://i.pravatar.cc/150?u=2",
    score: 80,
    status: "Viewing",
    hotLevel: "Warm",
    source: "Website",
    job: "Sinh viên",
    need: "Phòng Studio, gần trường",
    budget: "5M - 6M",
    roomType: "Studio",
    building: "HomeLand Campus",
    contactDate: "24/06/2026",
    nextFollowup: "Ngày mai, 10:00",
    viewingSchedule: "Hôm nay, 14:00",
    salesName: "Minh Trang",
    expectedRevenue: "6,000,000",
    commission: "900,000"
  },
  {
    id: "L-2403",
    name: "Lê Văn C",
    phone: "0912345678",
    email: "levanc@gmail.com",
    avatar: "https://i.pravatar.cc/150?u=3",
    score: 60,
    status: "Consulting",
    hotLevel: "Cold",
    source: "Referral",
    job: "Nhân viên văn phòng",
    need: "Phòng trọ giá rẻ",
    budget: "3M - 4M",
    roomType: "Phòng trọ",
    building: "Chưa xác định",
    contactDate: "22/06/2026",
    nextFollowup: "28/06, 09:00",
    viewingSchedule: "Chưa có",
    salesName: "Tuấn Đạt",
    expectedRevenue: "3,500,000",
    commission: "525,000"
  },
  {
    id: "L-2404",
    name: "Phạm Thị D",
    phone: "0977112233",
    email: "phamthid@gmail.com",
    avatar: "https://i.pravatar.cc/150?u=4",
    score: 98,
    status: "Deposit",
    hotLevel: "Hot",
    source: "TikTok",
    job: "Kinh doanh tự do",
    need: "Duplex 2PN, nội thất cao cấp",
    budget: "15M - 18M",
    roomType: "Duplex",
    building: "HomeLand Premium",
    contactDate: "20/06/2026",
    nextFollowup: "Hôm nay, 16:30",
    viewingSchedule: "Đã xem 23/06",
    salesName: "Hoàng Long",
    expectedRevenue: "16,500,000",
    commission: "2,475,000"
  }
];

export default function OperationsSalesMain() {
  const searchParams = useSearchParams();
  const activeStageId = searchParams.get("stage");

  const stageIdToStatusMap: Record<string, string> = {
    "lead": "Mới Nhận",
    "contacted": "Đã Gọi",
    "consulting": "Consulting",
    "viewing": "Viewing",
    "negotiating": "Negotiating",
    "deposit": "Deposit",
    "won": "Thành Công",
    "lost": "Thất Bại"
  };

  const filteredLeads = activeStageId && stageIdToStatusMap[activeStageId]
    ? leads.filter(l => l.status === stageIdToStatusMap[activeStageId])
    : leads;

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[12px]">
          <h2 className="font-black text-[18px] text-text">
            {activeStageId && stageIdToStatusMap[activeStageId] ? `Leads: ${stageIdToStatusMap[activeStageId]}` : "Tất cả Leads"}
          </h2>
          <span className="bg-border text-muted font-bold text-[12px] px-2 py-0.5 rounded-full">{filteredLeads.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-[16px]">
        {filteredLeads.map((lead) => (
          <OperationsSalesLeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

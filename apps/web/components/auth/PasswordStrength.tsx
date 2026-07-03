import React from "react";

interface Props {
  password?: string;
}

export default function PasswordStrength({ password = "" }: Props) {
  const calculateStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length > 7) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  };

  const score = calculateStrength();
  
  const getLabel = () => {
    if (score === 0) return "Chưa nhập";
    if (score < 2) return "Yếu";
    if (score === 2) return "Trung bình";
    return "Mạnh";
  };

  const getColorClass = (index: number) => {
    if (score === 0) return "bg-border";
    if (score < 2) return index === 0 ? "bg-rose-500" : "bg-border";
    if (score === 2) return index < 2 ? "bg-[#f59e0b]" : "bg-border";
    return "bg-[#10b981]";
  };

  return (
    <div className="flex flex-col gap-[6px] mt-[4px]">
      <div className="flex gap-[4px] h-[4px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex-1 rounded-full transition-colors duration-300 ${getColorClass(i)}`}></div>
        ))}
      </div>
      <div className="text-[12px] font-medium text-muted flex justify-end">
        {getLabel()}
      </div>
    </div>
  );
}

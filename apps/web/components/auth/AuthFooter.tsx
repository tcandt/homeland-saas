import React from "react";
import Link from "next/link";

interface Props {
  text: string;
  linkText: string;
  href: string;
}

export default function AuthFooter({ text, linkText, href }: Props) {
  return (
    <div className="flex justify-center items-center gap-[6px] mt-[32px]">
      <span className="text-[14px] font-medium text-muted">{text}</span>
      <Link href={href} className="text-[14px] font-bold text-[#6366f1] hover:underline">
        {linkText}
      </Link>
    </div>
  );
}

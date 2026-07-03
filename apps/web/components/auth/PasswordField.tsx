import React, { useState, useEffect } from "react";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import AuthInput from "./AuthInput";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export default function PasswordField({ label, error, ...props }: Props) {
  const [show, setShow] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState("CapsLock")) {
      setCapsLockOn(true);
    } else {
      setCapsLockOn(false);
    }
  };

  return (
    <div className="relative">
      <AuthInput 
        label={label} 
        error={error} 
        type={show ? "text" : "password"} 
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyDown}
        {...props} 
      />
      <div className="absolute right-[16px] top-[42px] md:top-[44px] flex items-center gap-[8px] -translate-y-1/2">
        {capsLockOn && (
          <div className="text-[#f59e0b]" title="Caps Lock is ON">
            <AlertTriangle size={16} />
          </div>
        )}
        <button 
          type="button" 
          onClick={() => setShow(!show)}
          className="text-muted hover:text-text transition-colors"
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreateCustomerSchema, UpdateCustomerSchema } from "@homeland/shared";
import { useCreateCustomerMutation, useUpdateCustomerMutation } from "@/lib/mutations/customers.mutations";
import { Button } from "../ui/Button";
import { Drawer } from "../ui/Drawer";
import { Input } from "../ui/Input";

type FormData = z.infer<typeof CreateCustomerSchema>;

interface TenantFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant?: any; // If provided, it's edit mode
}

export default function TenantFormModal({ isOpen, onClose, tenant }: TenantFormModalProps) {
  const createMutation = useCreateCustomerMutation();
  const updateMutation = useUpdateCustomerMutation();

  const isEdit = !!tenant;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(CreateCustomerSchema as any),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      citizenId: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (tenant) {
        reset({
          fullName: tenant.name || tenant.fullName || "",
          phone: tenant.phone || "",
          email: tenant.email || "",
          citizenId: tenant.identityNo || tenant.citizenId || "",
          notes: tenant.notes || "",
        });
      } else {
        reset({
          fullName: "",
          phone: "",
          email: "",
          citizenId: "",
          notes: "",
        });
      }
    }
  }, [isOpen, tenant, reset]);

  const onSubmit = (data: FormData) => {
    if (isEdit) {
      updateMutation.mutate(
        { id: tenant.id, data },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  return (
    <Drawer
      testId="tenant-form-drawer"
      closeTestId="tenant-form-close"
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={isEdit ? "Cập nhật khách thuê" : "Thêm khách thuê mới"}
      className="p-6"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-4" data-testid="tenant-form">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-bold text-text">Họ và tên</label>
          <Input
            placeholder="Nhập họ và tên"
            {...register("fullName")}
            error={errors.fullName?.message}
            data-testid="input-fullName"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-bold text-text">Số điện thoại</label>
          <Input
            placeholder="Nhập số điện thoại"
            {...register("phone")}
            error={errors.phone?.message}
            data-testid="input-phone"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-bold text-text">Email (Không bắt buộc)</label>
          <Input
            placeholder="Nhập email"
            {...register("email")}
            error={errors.email?.message}
            data-testid="input-email"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-bold text-text">CCCD / CMND (Không bắt buộc)</label>
          <Input
            placeholder="Nhập số CCCD"
            {...register("citizenId")}
            error={errors.citizenId?.message}
            data-testid="input-citizenId"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-bold text-text">Ghi chú</label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Nhập ghi chú"
            {...register("notes")}
            data-testid="input-notes"
          />
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border/40">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending} data-testid="tenant-form-cancel">
            Hủy
          </Button>
          <Button type="submit" variant="primary" disabled={isPending} data-testid="tenant-form-submit">
            {isPending ? "Đang lưu..." : "Lưu khách thuê"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

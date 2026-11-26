"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export interface AttendanceRecord {
  id: string;
  workDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  status: string;
  matchScore?: number | null;
  livenessPassed: boolean;
  approvalStatus: "APPROVED" | "PENDING" | "REJECTED";
  approvalDisplayStatus?:
    | "PENDING"
    | "NEEDS_MORE_INFO"
    | "APPROVED"
    | "REJECTED"
    | null;
  exceptionType?:
    | "OUTSIDE_GEOFENCE"
    | "WRONG_SCHEDULE"
    | "FACE_UNRECOGNIZED"
    | "GPS_UNAVAILABLE"
    | "MISSED_PUNCH"
    | "LATE_ARRIVAL"
    | "OTHER"
    | null;
  approvalReasons?: Array<NonNullable<AttendanceRecord["exceptionType"]>>;
  approvalItems?: Array<{
    type: string;
    decision: "PENDING" | "APPROVED" | "REJECTED";
    note?: string;
    proposedCheckIn?: string;
    proposedCheckOut?: string;
    proposedCheckIn2?: string;
    proposedCheckOut2?: string;
    workScheduleId?: string;
    workScheduleBranchIds?: string[];
    workScheduleName?: string;
    branchLocationId?: string;
    targetEmployeeId?: string;
    overtimeMinutes?: number;
  }>;
  approvalRequestNote?: string | null;
  approvalEvidencePhotos?: string[];
  approvalReviewNote?: string | null;
  manualWorkScheduleName?: string | null;
  workScheduleName?: string | null;
  totalMinutes?: number;
  lateMinutes?: number | null;
  latePenalty?: number | null;
  manualReward?: number | null;
  attendanceBranchName?: string | null;
  sessions?: {
    id: string;
    sequence: number;
    checkInAt: string;
    checkOutAt?: string | null;
    checkOutUpdateCount: number;
    checkInPhoto?: string | null;
    checkOutPhoto?: string | null;
  }[];
  employee: { id: string; fullName: string; employeeNo: string };
}

export interface OvertimeEligibility {
  canRequest: boolean;
  eligibleMinutes: number;
  triggerMinutes?: number;
}

export interface AttendanceCheckResult extends AttendanceRecord {
  overtime?: OvertimeEligibility;
}

export interface AttendanceCorrectionRequest {
  id: string;
  attendanceId?: string | null;
  workDate: string;
  proposedCheckIn?: string | null;
  proposedCheckOut?: string | null;
  reason: string;
  status: "PENDING" | "NEEDS_MORE_INFO" | "APPROVED" | "REJECTED";
  reviewNote?: string | null;
  evidencePhoto?: string | null;
  hasEvidencePhoto: boolean;
  createdAt: string;
  updatedAt: string;
  history: {
    id: string;
    action: string;
    note?: string | null;
    createdAt: string;
  }[];
  employee?: { id: string; fullName: string; employeeNo: string };
}

export interface AttendanceDetail extends AttendanceRecord {
  employee: AttendanceRecord["employee"] & {
    department?: { name: string } | null;
  };
  geofenceReason?: string | null;
  approvalReviewedAt?: string | null;
  sessions: {
    id: string;
    sequence: number;
    checkInAt: string;
    checkOutAt?: string | null;
    checkInLat?: number | null;
    checkInLng?: number | null;
    checkOutLat?: number | null;
    checkOutLng?: number | null;
    checkInAccuracyMeters?: number | null;
    checkOutAccuracyMeters?: number | null;
    checkInDistanceMeters?: number | null;
    checkOutDistanceMeters?: number | null;
    checkOutUpdateCount: number;
    checkInLocation?: string | null;
    checkOutLocation?: string | null;
    checkInPhoto?: string | null;
    checkOutPhoto?: string | null;
  }[];
}

export interface AttendanceApprovalHistoryEntry {
  id: string;
  action: "CREATE" | "UPDATE" | "APPROVE" | "REJECT" | "DELETE" | "EXPORT";
  createdAt: string;
  actor?: { fullName: string; email: string } | null;
}

export interface AttendanceSummary {
  date: string;
  totalActive: number;
  counts: Record<string, number>;
}

export interface EligibleLocation {
  id: string;
  name: string;
  branchName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  allowRemote: boolean;
}

interface CheckPayload {
  employeeId?: string;
  borrowedAttendanceConfirmed?: boolean;
  embedding: number[];
  livenessPassed: boolean;
  livenessChallenge?: "NONE" | "BLINK" | "TURN_LEFT" | "TURN_RIGHT" | "SMILE";
  livenessToken?: string;
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  photo?: string;
  deviceInfo?: Record<string, unknown>;
}

const keys = {
  list: (d?: string) => ["attendance", "list", d ?? "today"] as const,
  summary: (d?: string) => ["attendance", "summary", d ?? "today"] as const,
  faceStatus: (id: string) => ["attendance", "face-status", id] as const,
};

export function useAttendanceList(date?: string) {
  return useQuery({
    queryKey: keys.list(date),
    queryFn: async () => {
      const { data } = await api.get<AttendanceRecord[]>("/attendance", {
        params: date ? { date } : undefined,
      });
      return data;
    },
  });
}

export interface AttendanceHistoryFilters {
  employeeId?: string;
  branchId?: string;
  from?: string;
  to?: string;
  status?: string;
  approvalStatus?: "APPROVED" | "PENDING" | "REJECTED";
}
export function useAttendanceHistory(filters: AttendanceHistoryFilters) {
  return useQuery({
    queryKey: ["attendance", "history", filters],
    queryFn: async () =>
      (await api.get<AttendanceRecord[]>("/attendance", { params: filters }))
        .data,
  });
}
export function useAttendanceDetail(id: string) {
  return useQuery({
    queryKey: ["attendance", "detail", id],
    queryFn: async () =>
      (await api.get<AttendanceDetail>(`/attendance/${id}`)).data,
    enabled: Boolean(id),
  });
}

export interface MyAttendanceSummary {
  counts: Record<string, number>;
  today: {
    checkInAt?: string | null;
    checkOutAt?: string | null;
    status: string;
    approvalStatus: AttendanceRecord["approvalStatus"];
    approvalDisplayStatus?: AttendanceRecord["approvalDisplayStatus"];
    sessions: {
      sequence: number;
      checkInAt: string;
      checkOutAt?: string | null;
      checkOutUpdateCount: number;
    }[];
  } | null;
  enrolled: boolean;
}

export function useMyAttendanceSummary() {
  return useQuery({
    queryKey: ["attendance", "me-summary"],
    queryFn: async () =>
      (await api.get<MyAttendanceSummary>("/attendance/me/summary")).data,
  });
}

export function useAttendanceSummary(date?: string) {
  return useQuery({
    queryKey: keys.summary(date),
    queryFn: async () => {
      const { data } = await api.get<AttendanceSummary>("/attendance/summary", {
        params: date ? { date } : undefined,
      });
      return data;
    },
  });
}

export function useFaceStatus(employeeId: string) {
  return useQuery({
    queryKey: keys.faceStatus(employeeId),
    queryFn: async () => {
      const { data } = await api.get<{ enrolled: boolean; profiles: number }>(
        `/attendance/face/${employeeId}/status`,
      );
      return data;
    },
    enabled: !!employeeId,
  });
}

export function useEligibleLocations(employeeId: string) {
  return useQuery({
    queryKey: ["attendance", "eligible-locations", employeeId],
    queryFn: async () =>
      (
        await api.get<EligibleLocation[]>(
          `/attendance/employees/${employeeId}/eligible-locations`,
        )
      ).data,
    enabled: !!employeeId,
  });
}

export interface AttendanceCheckPolicy {
  requireGps: boolean;
  livenessMode: "NONE" | "BLINK" | "TURN_HEAD" | "SMILE" | "RANDOM";
}

export function useAttendanceCheckPolicy() {
  return useQuery({
    queryKey: ["attendance", "check-policy"],
    queryFn: async () =>
      (await api.get<AttendanceCheckPolicy>("/attendance/check-policy")).data,
  });
}

export interface AttendanceLivenessChallenge {
  challenge: "BLINK" | "TURN_LEFT" | "TURN_RIGHT" | "SMILE";
  token: string;
  expiresAt: string;
}

export function useAttendanceLivenessChallenge() {
  return useMutation({
    mutationFn: async () =>
      (
        await api.post<AttendanceLivenessChallenge>(
          "/attendance/liveness-challenge",
        )
      ).data,
  });
}

export interface ApprovalRequestPayload {
  employeeId: string;
  attendanceId?: string;
  action: "CHECK_IN" | "CHECK_OUT" | "REVIEW";
  exceptionType: NonNullable<AttendanceRecord["exceptionType"]>;
  exceptionTypes?: Array<
    NonNullable<AttendanceRecord["exceptionType"]> | "OVERTIME"
  >;
  note: string;
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  photo?: string;
  evidencePhotos?: string[];
  targetEmployeeId?: string;
  branchLocationId?: string;
  workScheduleId?: string;
  appliesTo?: "CHECK_IN" | "CHECK_OUT";
  proposedCheckIn?: string;
  proposedCheckOut?: string;
  proposedCheckIn2?: string;
  proposedCheckOut2?: string;
  overtimeMinutes?: number;
  deviceInfo?: Record<string, unknown>;
}

export interface ManualAttendancePayload {
  employeeId: string;
  action: "CHECK_IN" | "CHECK_OUT";
  workScheduleId: string;
  reason: string;
  photo: string;
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  deviceInfo?: Record<string, unknown>;
}

export interface ManualAttendanceWorkSchedule {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  secondStartTime?: string | null;
  secondEndTime?: string | null;
}

export function useManualAttendanceWorkSchedules(enabled = true) {
  return useQuery({
    queryKey: ["attendance", "manual-work-schedules"],
    queryFn: async () =>
      (
        await api.get<ManualAttendanceWorkSchedule[]>(
          "/attendance/manual-work-schedules",
        )
      ).data,
    enabled,
  });
}

export function useCreateManualAttendanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ManualAttendancePayload) =>
      (await api.post<AttendanceRecord>("/attendance/manual-requests", payload))
        .data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Đã gửi chấm công thủ công, phiên đang chờ duyệt");
    },
    onError: (e) => toast.error(errMsg(e, "Không thể gửi chấm công thủ công")),
  });
}

export function useCreateAttendanceApprovalRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ApprovalRequestPayload) =>
      (
        await api.post<AttendanceRecord>(
          "/attendance/approval-requests",
          payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Đã gửi yêu cầu chấm công, đang chờ duyệt");
    },
    onError: (e) => toast.error(errMsg(e, "Không thể gửi yêu cầu duyệt")),
  });
}

export function usePendingAttendanceApprovals(enabled = true) {
  return useQuery({
    queryKey: ["attendance", "pending-approvals"],
    queryFn: async () =>
      (await api.get<AttendanceRecord[]>("/attendance/pending-approvals")).data,
    enabled,
  });
}

export function useReviewAttendanceApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      decision,
      note,
      itemReviews,
    }: {
      id: string;
      decision?: "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";
      note?: string;
      itemReviews?: Array<{
        type: string;
        decision: "APPROVED" | "REJECTED";
        note?: string;
        proposedCheckIn?: string;
        proposedCheckOut?: string;
        proposedCheckIn2?: string;
        proposedCheckOut2?: string;
        workScheduleId?: string;
        branchLocationId?: string;
        targetEmployeeId?: string;
        overtimeMinutes?: number;
      }>;
    }) =>
      (
        await api.put<AttendanceRecord>(`/attendance/${id}/review`, {
          decision,
          note,
          itemReviews,
        })
      ).data,
    onSuccess: (_record, variables) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success(
        variables.decision === "APPROVED"
          ? "Đã duyệt chấm công"
          : variables.decision === "NEEDS_MORE_INFO"
            ? "Đã yêu cầu nhân viên bổ sung"
            : "Đã từ chối yêu cầu",
      );
    },
    onError: (e) => toast.error(errMsg(e, "Không thể xử lý yêu cầu")),
  });
}

export function useAttendanceApprovalHistory(id?: string, enabled = true) {
  return useQuery({
    queryKey: ["attendance", id, "approval-history"],
    queryFn: async () =>
      (
        await api.get<AttendanceApprovalHistoryEntry[]>(
          `/attendance/${id}/approval-history`,
        )
      ).data,
    enabled: Boolean(id) && enabled,
  });
}

export function useDeleteAttendanceApprovalRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete<AttendanceRecord>(`/attendance/${id}/approval-request`))
        .data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Đã xóa phiếu xin duyệt");
    },
    onError: (e) => toast.error(errMsg(e, "Không thể xóa phiếu xin duyệt")),
  });
}

export function useUpdateAttendanceAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      workScheduleId?: string;
      latePenalty?: number;
      reward?: number;
    }) =>
      (await api.put<AttendanceRecord>(`/attendance/${id}/adjustment`, payload))
        .data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Đã cập nhật bản ghi chấm công");
    },
    onError: (e) =>
      toast.error(errMsg(e, "Không thể cập nhật bản ghi chấm công")),
  });
}

export interface UpdateAttendanceSessionPayload {
  attendanceId: string;
  sessionId: string;
  checkInAt?: string;
  checkOutAt?: string;
}

type AttendanceSession = NonNullable<AttendanceRecord["sessions"]>[number];

export function useUpdateAttendanceSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      attendanceId,
      sessionId,
      ...payload
    }: UpdateAttendanceSessionPayload) =>
      (
        await api.put<AttendanceSession>(
          `/attendance/${attendanceId}/sessions/${sessionId}`,
          payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Đã cập nhật phiên chấm công");
    },
    onError: (e) =>
      toast.error(errMsg(e, "Không thể cập nhật phiên chấm công")),
  });
}

export function useCreateAttendanceSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      attendanceId,
      ...payload
    }: {
      attendanceId: string;
      checkInAt: string;
      checkOutAt?: string;
    }) =>
      (
        await api.post<AttendanceSession>(
          `/attendance/${attendanceId}/sessions`,
          payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Đã thêm ca chấm công");
    },
    onError: (e) => toast.error(errMsg(e, "Không thể thêm ca chấm công")),
  });
}

export function useDeleteAttendanceSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      attendanceId,
      sessionId,
    }: Pick<UpdateAttendanceSessionPayload, "attendanceId" | "sessionId">) =>
      (await api.delete(`/attendance/${attendanceId}/sessions/${sessionId}`))
        .data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Đã xóa phiên chấm công");
    },
    onError: (e) => toast.error(errMsg(e, "Không thể xóa phiên chấm công")),
  });
}

export function useEnrollFace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employeeId: string;
      embeddings: number[][];
      sampleImage?: string;
    }) => {
      const { data } = await api.post("/attendance/face/enroll", payload);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: keys.faceStatus(v.employeeId) });
      qc.invalidateQueries({ queryKey: ["attendance", "me-summary"] });
      toast.success("Đã đăng ký khuôn mặt");
    },
    onError: (e) => toast.error(errMsg(e, "Không thể đăng ký khuôn mặt")),
  });
}

export function usePurgeFace(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.delete(`/attendance/face/${employeeId}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.faceStatus(employeeId) });
      void qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Đã xóa dữ liệu khuôn mặt; nhân viên có thể đăng ký lại.");
    },
    onError: (e) => toast.error(errMsg(e, "Không thể xóa khuôn mặt")),
  });
}

export function useCheck(kind: "check-in" | "check-out") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CheckPayload) => {
      const path = payload.borrowedAttendanceConfirmed
        ? `/attendance/${kind}/identify`
        : `/attendance/${kind}`;
      const { data } = await api.post(path, payload);
      return data as AttendanceCheckResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success(
        kind === "check-in" ? "Checkin thành công" : "Checkout thành công",
      );
    },
    onError: (e) => toast.error(errMsg(e, "Xác minh không thành công")),
  });
}

export function useCreateOvertimeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { attendanceId: string; reason: string }) =>
      (await api.post("/attendance/overtime-requests", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Đã gửi yêu cầu làm thêm, chờ quản lý duyệt");
    },
    onError: (e) => toast.error(errMsg(e, "Không thể gửi yêu cầu làm thêm")),
  });
}

export function useCreateAttendanceCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      workDate: string;
      proposedCheckIn?: string;
      proposedCheckOut?: string;
      reason: string;
      evidencePhoto?: string;
    }) => (await api.post("/attendance/correction-requests", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Đã gửi yêu cầu bổ sung chấm công, chờ quản lý duyệt");
    },
    onError: (e) => toast.error(errMsg(e, "Không thể gửi yêu cầu bổ sung")),
  });
}

export function useAttendanceCorrectionRequests(attendanceId: string) {
  return useQuery({
    queryKey: ["attendance", "correction-requests", attendanceId],
    queryFn: async () =>
      (
        await api.get<AttendanceCorrectionRequest[]>(
          `/attendance/${attendanceId}/correction-requests`,
        )
      ).data,
    enabled: Boolean(attendanceId),
  });
}

export function usePendingAttendanceCorrections(enabled = true) {
  return useQuery({
    queryKey: ["attendance", "pending-correction-requests"],
    queryFn: async () =>
      (
        await api.get<AttendanceCorrectionRequest[]>(
          "/attendance/correction-requests/pending",
        )
      ).data,
    enabled,
  });
}

export function useUpdateAttendanceCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      proposedCheckIn?: string;
      proposedCheckOut?: string;
      reason: string;
      evidencePhoto?: string;
    }) =>
      (
        await api.put<AttendanceCorrectionRequest>(
          `/attendance/correction-requests/${id}`,
          payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Đã cập nhật yêu cầu và gửi lại chờ duyệt");
    },
    onError: (e) => toast.error(errMsg(e, "Không thể cập nhật yêu cầu")),
  });
}

export function useReviewAttendanceCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";
      note?: string;
    }) =>
      (
        await api.put<AttendanceCorrectionRequest>(
          `/attendance/correction-requests/${id}/review`,
          { decision, note },
        )
      ).data,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success(
        variables.decision === "APPROVED"
          ? "Đã duyệt yêu cầu"
          : variables.decision === "REJECTED"
            ? "Đã từ chối yêu cầu"
            : "Đã yêu cầu nhân viên bổ sung thông tin",
      );
    },
    onError: (e) => toast.error(errMsg(e, "Không thể xử lý yêu cầu")),
  });
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  return msg ?? fallback;
}

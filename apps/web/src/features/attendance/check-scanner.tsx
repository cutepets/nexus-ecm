"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Camera,
  Loader2,
  RefreshCw,
  Send,
  SwitchCamera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFaceCamera } from "./face/useFaceCamera";
import { detectSingleFace, descriptorToArray } from "./face/detectFace";
import { checkQuality } from "./face/quality";
import {
  CHALLENGE_LABEL,
  LivenessTracker,
  type LivenessChallenge,
} from "./face/liveness";
import {
  type AttendanceCheckResult,
  type AttendanceRecord,
  useAttendanceCheckPolicy,
  useCheck,
  useCreateAttendanceApprovalRequest,
  useCreateManualAttendanceRequest,
  useCreateOvertimeRequest,
  useEligibleLocations,
  useAttendanceLivenessChallenge,
  useManualAttendanceWorkSchedules,
} from "./api";
import { api } from "@/lib/api-client";
import { useEmployees } from "@/features/employees/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatCurrency } from "@/lib/utils";
import { useBranches } from "@/features/settings/api";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Phase = "init" | "liveness" | "submitting" | "done" | "error";

const REVIEW_REASON_OPTIONS: Array<{
  value: NonNullable<AttendanceCheckResult["exceptionType"]>;
  label: string;
}> = [
  { value: "WRONG_SCHEDULE", label: "Đổi ca / sai ca" },
  { value: "GPS_UNAVAILABLE", label: "Lỗi GPS hoặc vị trí" },
  { value: "FACE_UNRECOGNIZED", label: "Lỗi nhận diện khuôn mặt" },
  { value: "MISSED_PUNCH", label: "Quên chấm công" },
  { value: "LATE_ARRIVAL", label: "Xin đi muộn (miễn phạt)" },
  { value: "OTHER", label: "Lý do khác" },
];

function inputTimeOf(v?: string | null) {
  return v
    ? new Date(v).toLocaleTimeString("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "";
}

export function CheckScanner({
  kind,
  approvalEmployeeId,
  onPunchCompleted,
}: {
  kind: "check-in" | "check-out";
  approvalEmployeeId?: string;
  onPunchCompleted?: () => void;
}) {
  const router = useRouter();
  const {
    videoRef,
    ready,
    error: cameraError,
    capturePhoto,
    facingMode,
    switchCamera,
    retry,
    stopCamera,
  } = useFaceCamera();
  const check = useCheck(kind);
  const requestApproval = useCreateAttendanceApprovalRequest();
  const manualAttendance = useCreateManualAttendanceRequest();
  const requestOvertime = useCreateOvertimeRequest();
  const { data: policy } = useAttendanceCheckPolicy();
  const livenessChallengeRequest = useAttendanceLivenessChallenge();
  const canManage = useAuthStore((state) =>
    state.hasPermission("attendance:update"),
  );
  const { data: employees } = useEmployees({
    pageSize: 100,
    sortBy: "fullName",
    sortOrder: "asc",
  });
  const [manualEmployeeId, setManualEmployeeId] = useState(
    approvalEmployeeId ?? "",
  );
  const selectedEmployeeId = approvalEmployeeId ?? manualEmployeeId;
  const { data: eligibleLocations } = useEligibleLocations(selectedEmployeeId);
  const { data: workSchedules } = useManualAttendanceWorkSchedules(
    Boolean(selectedEmployeeId),
  );
  const { data: branches } = useBranches();
  const [phase, setPhase] = useState<Phase>("init");
  const [hint, setHint] = useState("Đang khởi động camera…");
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
    accuracyMeters: number;
  } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [checkedRecord, setCheckedRecord] =
    useState<AttendanceCheckResult | null>(null);
  // Keep the action that produced the receipt. The dashboard summary refetches
  // after a successful punch and can change the next action immediately.
  const [completedKind, setCompletedKind] = useState<
    "check-in" | "check-out" | null
  >(null);
  const [overtimeReason, setOvertimeReason] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [manualScheduleId, setManualScheduleId] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualPhoto, setManualPhoto] = useState<string>();
  const [manualError, setManualError] = useState("");
  const [borrowedMode, setBorrowedMode] = useState(false);
  const [suggestBorrowedAttendance, setSuggestBorrowedAttendance] =
    useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewReasons, setReviewReasons] = useState<
    Array<NonNullable<AttendanceCheckResult["exceptionType"]>>
  >([]);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewTargetEmployeeId, setReviewTargetEmployeeId] = useState("");
  const [reviewBranchLocationId, setReviewBranchLocationId] = useState("");
  const [reviewWorkScheduleId, setReviewWorkScheduleId] = useState("");
  const [reviewWorkScheduleBranchIds, setReviewWorkScheduleBranchIds] = useState<string[]>([]);
  const [reviewCheckInTime, setReviewCheckInTime] = useState("");
  const [reviewCheckOutTime, setReviewCheckOutTime] = useState("");
  const [reviewCheckIn2Time, setReviewCheckIn2Time] = useState("");
  const [reviewCheckOut2Time, setReviewCheckOut2Time] = useState("");
  const [reviewEvidencePhotos, setReviewEvidencePhotos] = useState<string[]>(
    [],
  );
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const trackerRef = useRef<LivenessTracker | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const startedAtRef = useRef(0);
  const lastDetectionAtRef = useRef(0);
  const lastPhotoRef = useRef<string | undefined>();
  const attendancePhotoRef = useRef<string | undefined>();
  const livenessTokenRef = useRef<string | undefined>();

  useEffect(() => {
    if (!reviewReasons.includes("MISSED_PUNCH") || !checkedRecord) return;
    const assignedSchedule = workSchedules?.find(
      (schedule) =>
        schedule.name ===
        (checkedRecord.manualWorkScheduleName ??
          checkedRecord.workScheduleName),
    );
    setReviewCheckInTime(
      (current) =>
        current ||
        inputTimeOf(checkedRecord.checkInAt) ||
        assignedSchedule?.startTime ||
        "",
    );
    setReviewCheckOutTime(
      (current) =>
        current ||
        inputTimeOf(checkedRecord.checkOutAt) ||
        assignedSchedule?.endTime ||
        "",
    );
    setReviewCheckIn2Time(
      (current) =>
        current ||
        inputTimeOf(
          checkedRecord.sessions?.find((session) => session.sequence === 2)
            ?.checkInAt,
        ) ||
        assignedSchedule?.secondStartTime ||
        "",
    );
    setReviewCheckOut2Time(
      (current) =>
        current ||
        inputTimeOf(
          checkedRecord.sessions?.find((session) => session.sequence === 2)
            ?.checkOutAt,
        ) ||
        assignedSchedule?.secondEndTime ||
        "",
    );
  }, [checkedRecord, reviewReasons, workSchedules]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Trình duyệt không hỗ trợ định vị GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        }),
      () =>
        setLocationError(
          "Không lấy được vị trí. Hãy cấp quyền Vị trí rồi thử lại.",
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);
  const registerAutomaticFailure = (message: string) => {
    setFailedAttempts((count) => count + 1);
    setPhase("error");
    setHint(message);
  };

  const submit = useCallback(
    (
      detection: Awaited<ReturnType<typeof detectSingleFace>>,
      activeChallenge: LivenessChallenge | null,
    ) => {
      if (!detection || !policy) return;
      stopLoop();
      setPhase("submitting");
      setHint("Đang xác minh an toàn…");
      const photo = attendancePhotoRef.current ?? capturePhoto() ?? undefined;
      lastPhotoRef.current = photo;
      const livenessChallenge =
        policy.livenessMode === "NONE"
          ? "NONE"
          : activeChallenge === "blink"
            ? "BLINK"
            : activeChallenge === "turnLeft"
              ? "TURN_LEFT"
              : activeChallenge === "turnRight"
                ? "TURN_RIGHT"
                : "SMILE";
      check.mutate(
        {
          employeeId: borrowedMode ? undefined : approvalEmployeeId,
          borrowedAttendanceConfirmed: borrowedMode || undefined,
          embedding: descriptorToArray(detection),
          livenessPassed:
            policy.livenessMode === "NONE" || Boolean(activeChallenge),
          livenessChallenge,
          livenessToken: livenessTokenRef.current,
          lat: coords?.lat,
          lng: coords?.lng,
          accuracyMeters: coords?.accuracyMeters,
          photo,
          deviceInfo: {
            userAgent: navigator.userAgent,
            camera: facingMode,
            liveness: trackerRef.current?.audit(),
          },
        },
        {
          onSuccess: (record) => {
            setCheckedRecord(record);
            setCompletedKind(kind);
            setPhase("done");
            onPunchCompleted?.();
            setHint("Đã chấm công thành công");
            enrichAttendanceResult(record);
          },
          onError: (error) => {
            const message = String(
              (
                error as {
                  response?: { data?: { message?: string | string[] } };
                }
              ).response?.data?.message ?? "",
            );
            const isFaceMismatch = message.includes(
              "Không nhận diện được khuôn mặt",
            );
            setSuggestBorrowedAttendance(!borrowedMode && isFaceMismatch);
            registerAutomaticFailure(
              message || "Không thể xác minh chấm công tự động.",
            );
          },
        },
      );
    },
    [
      approvalEmployeeId,
      borrowedMode,
      capturePhoto,
      check,
      coords,
      facingMode,
      kind,
      onPunchCompleted,
      policy,
      stopLoop,
    ],
  );

  const beginScanning = useCallback(() => {
    const start = async () => {
      if (!policy || !ready || startedRef.current) return;
      if (policy.requireGps && !coords) {
        setHint("Đang lấy vị trí GPS chính xác…");
        return;
      }
      startedRef.current = true;
      startedAtRef.current = Date.now();
      lastDetectionAtRef.current = 0;
      attendancePhotoRef.current = undefined;
      livenessTokenRef.current = undefined;
      let activeChallenge: LivenessChallenge | null = null;
      if (policy.livenessMode !== "NONE") {
        try {
          const issued = await livenessChallengeRequest.mutateAsync();
          const challengeMap: Record<
            "BLINK" | "TURN_LEFT" | "TURN_RIGHT" | "SMILE" | "NOD",
            LivenessChallenge
          > = {
            BLINK: "blink",
            TURN_LEFT: "turnLeft",
            TURN_RIGHT: "turnRight",
            SMILE: "smile",
            NOD: "nod",
          };
          activeChallenge = challengeMap[issued.challenge];
          livenessTokenRef.current = issued.token;
        } catch {
          registerAutomaticFailure(
            "Không thể khởi tạo xác minh sống. Hãy thử lại.",
          );
          return;
        }
      }
      setChallenge(null);
      trackerRef.current = activeChallenge
        ? new LivenessTracker(activeChallenge)
        : null;
      setPhase(activeChallenge ? "liveness" : "submitting");
      setHint(
        activeChallenge
          ? "Giữ mặt thẳng, mở mắt và nhìn vào camera…"
          : "Đang tìm khuôn mặt…",
      );
      const tick = async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const now = performance.now();
        const elapsed = now - lastDetectionAtRef.current;
        if (elapsed < 100) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        lastDetectionAtRef.current = now;
        const detection = await detectSingleFace(video);
        if (!detection) {
          if (Date.now() - startedAtRef.current > 20_000) {
            lastPhotoRef.current = capturePhoto() ?? undefined;
            registerAutomaticFailure("Không nhận diện được khuôn mặt.");
            stopLoop();
            return;
          }
          setHint("Đặt một khuôn mặt vào trong khung và nhìn thẳng camera");
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const quality = checkQuality(detection);
        if (!quality.ok) {
          setHint(quality.reason ?? "Điều chỉnh vị trí khuôn mặt");
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        if (!activeChallenge) {
          submit(detection, null);
          return;
        }
        const stage = trackerRef.current?.update(detection) ?? "baseline";
        if (stage === "baseline") {
          setHint("Giữ mặt thẳng, mở mắt và nhìn vào camera…");
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        if (stage === "challenge") {
          if (!attendancePhotoRef.current)
            attendancePhotoRef.current = capturePhoto() ?? undefined;
          setChallenge(activeChallenge);
          setHint(CHALLENGE_LABEL[activeChallenge]);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        if (stage === "recover") {
          setHint("Tốt, hãy nhìn thẳng lại camera để hoàn tất…");
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        submit(detection, activeChallenge);
      };
      rafRef.current = requestAnimationFrame(tick);
    };
    void start();
  }, [
    capturePhoto,
    coords,
    livenessChallengeRequest,
    policy,
    ready,
    stopLoop,
    submit,
    videoRef,
  ]);

  useEffect(() => {
    beginScanning();
  }, [beginScanning]);
  useEffect(() => () => stopLoop(), [stopLoop]);
  useEffect(() => {
    if (phase !== "done") return;
    stopLoop();
    stopCamera();
  }, [phase, stopCamera, stopLoop]);
  const tryAgain = () => {
    stopLoop();
    startedRef.current = false;
    setPhase("init");
    setSuggestBorrowedAttendance(false);
    setHint("Đang khởi động lại camera…");
    retry();
  };
  const changeCamera = () => {
    stopLoop();
    startedRef.current = false;
    setPhase("init");
    setHint("Đang đổi camera…");
    switchCamera();
  };
  const acceptBorrowedAttendance = () => {
    if (
      !window.confirm(
        "Khuôn mặt hiện tại không khớp với tài khoản đang đăng nhập. Bạn xác nhận đang chấm hộ trên thiết bị mượn? Hệ thống sẽ ghi công cho người được nhận diện.",
      )
    ) {
      return;
    }
    stopLoop();
    startedRef.current = false;
    setBorrowedMode(true);
    setSuggestBorrowedAttendance(false);
    setPhase("init");
    setHint("Đã xác nhận chấm hộ — đang nhận diện khuôn mặt nhân viên");
  };
  const captureManualPhoto = () => {
    const photo = capturePhoto();
    if (!photo) {
      setManualError(
        "Chưa thể chụp ảnh. Hãy kiểm tra quyền camera rồi thử lại.",
      );
      return;
    }
    setManualPhoto(photo);
    setManualError("");
  };
  const sendManualAttendance = () => {
    const photo = manualPhoto ?? lastPhotoRef.current ?? capturePhoto();
    if (
      !selectedEmployeeId ||
      !manualScheduleId ||
      manualReason.trim().length < 5 ||
      !photo
    ) {
      setManualError(
        "Hãy chụp ảnh, chọn ca làm và nhập lý do tối thiểu 5 ký tự.",
      );
      return;
    }
    manualAttendance.mutate(
      {
        employeeId: selectedEmployeeId,
        action: kind === "check-in" ? "CHECK_IN" : "CHECK_OUT",
        workScheduleId: manualScheduleId,
        reason: manualReason.trim(),
        photo,
        lat: coords?.lat,
        lng: coords?.lng,
        accuracyMeters: coords?.accuracyMeters,
        deviceInfo: { userAgent: navigator.userAgent, camera: facingMode },
      },
      {
        onSuccess: (record) => {
          setCheckedRecord(record);
          setCompletedKind(kind);
          setPhase("done");
          onPunchCompleted?.();
          setHint("Phiên chấm đang chờ quản lý duyệt");
          enrichAttendanceResult(record);
        },
      },
    );
  };
  const sendOvertimeRequest = () => {
    if (!checkedRecord || overtimeReason.trim().length < 5) return;
    requestOvertime.mutate({
      attendanceId: checkedRecord.id,
      reason: overtimeReason.trim(),
    });
  };

  const submitReviewRequest = () => {
    if (!checkedRecord || !reviewReasons.length || reviewNote.trim().length < 5)
      return;
    const workDate = checkedRecord.workDate.slice(0, 10);
    const toIso = (time: string) =>
      new Date(`${workDate}T${time}`).toISOString();
    requestApproval.mutate(
      {
        employeeId: checkedRecord.employee.id,
        attendanceId: checkedRecord.id,
        action: "REVIEW",
        exceptionType: reviewReasons[0],
        exceptionTypes: reviewReasons,
        note: reviewNote.trim(),
        lat: coords?.lat,
        lng: coords?.lng,
        accuracyMeters: coords?.accuracyMeters,
        photo: lastPhotoRef.current,
        ...(reviewEvidencePhotos.length
          ? { evidencePhotos: reviewEvidencePhotos }
          : {}),
        ...(reviewReasons.includes("FACE_UNRECOGNIZED") &&
        reviewTargetEmployeeId
          ? { targetEmployeeId: reviewTargetEmployeeId }
          : {}),
        ...(reviewReasons.includes("GPS_UNAVAILABLE") && reviewBranchLocationId
          ? {
              branchLocationId: reviewBranchLocationId,
              appliesTo:
                (completedKind ?? kind) === "check-in"
                  ? ("CHECK_IN" as const)
                  : ("CHECK_OUT" as const),
            }
          : {}),
        ...(reviewReasons.includes("WRONG_SCHEDULE") && reviewWorkScheduleId
          ? { workScheduleId: reviewWorkScheduleId, workScheduleBranchIds: reviewWorkScheduleBranchIds }
          : {}),
        ...(reviewReasons.includes("MISSED_PUNCH") && reviewCheckInTime
          ? { proposedCheckIn: toIso(reviewCheckInTime) }
          : {}),
        ...(reviewReasons.includes("MISSED_PUNCH") && reviewCheckOutTime
          ? { proposedCheckOut: toIso(reviewCheckOutTime) }
          : {}),
        ...(reviewReasons.includes("MISSED_PUNCH") && reviewCheckIn2Time
          ? { proposedCheckIn2: toIso(reviewCheckIn2Time) }
          : {}),
        ...(reviewReasons.includes("MISSED_PUNCH") && reviewCheckOut2Time
          ? { proposedCheckOut2: toIso(reviewCheckOut2Time) }
          : {}),
        deviceInfo: {
          userAgent: navigator.userAgent,
          attendanceId: checkedRecord.id,
        },
      },
      {
        onSuccess: () => {
          setReviewOpen(false);
          setReviewSubmitted(true);
        },
      },
    );
  };

  const addReviewEvidencePhotos = (files: FileList | null) => {
    const picked = Array.from(files ?? []).filter((file) =>
      file.type.startsWith("image/"),
    );
    const remaining = 5 - reviewEvidencePhotos.length;
    if (!picked.length || remaining <= 0) return;
    void Promise.all(
      picked.slice(0, remaining).map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    ).then((photos) =>
      setReviewEvidencePhotos((current) => [...current, ...photos].slice(0, 5)),
    );
  };

  const enrichAttendanceResult = (record: AttendanceCheckResult) => {
    const workDate = new Date(record.workDate).toISOString().slice(0, 10);
    void api
      .get<AttendanceRecord[]>("/attendance", { params: { date: workDate } })
      .then(({ data }) => {
        const detailed = data.find((item) => item.id === record.id);
        if (detailed) setCheckedRecord({ ...record, ...detailed });
      })
      // Never hide a successful attendance receipt because its extra details fail to load.
      .catch(() => undefined);
  };

  if (phase === "done" && checkedRecord) {
    const receiptKind = completedKind ?? kind;
    const punchedAt =
      receiptKind === "check-in"
        ? checkedRecord.checkInAt
        : checkedRecord.checkOutAt;
    const isPendingApproval = checkedRecord.approvalStatus === "PENDING";
    const totalHours =
      typeof checkedRecord.totalMinutes === "number" &&
      checkedRecord.totalMinutes > 0
        ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(checkedRecord.totalMinutes / 60)} giờ`
        : null;
    const latePenalty =
      checkedRecord.latePenalty == null
        ? null
        : formatCurrency(checkedRecord.latePenalty);
    return (
      <section className="mx-auto max-w-md rounded-card border border-emerald-200 bg-emerald-50 p-6 text-center shadow-card">
        <CheckCircle2 className="mx-auto size-16 text-emerald-600" />
        <h2 className="mt-3 text-xl font-semibold text-emerald-950">
          {isPendingApproval
            ? "Đã gửi yêu cầu chấm công"
            : "Chấm công thành công"}
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          {checkedRecord.employee.fullName}
        </p>
        <dl className="mt-5 divide-y divide-emerald-200 rounded-xl border border-emerald-200 bg-white text-left text-sm">
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-ink-muted">Nhân viên</dt>
            <dd className="font-medium">{checkedRecord.employee.fullName}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-ink-muted">Ngày chấm</dt>
            <dd className="font-medium">
              {new Date(checkedRecord.workDate).toLocaleDateString("vi-VN")}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-ink-muted">Lượt chấm</dt>
            <dd className="font-medium">
              {receiptKind === "check-in" ? "Checkin" : "Checkout"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-ink-muted">Thời gian</dt>
            <dd className="font-medium">
              {punchedAt ? new Date(punchedAt).toLocaleString("vi-VN") : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-ink-muted">Chi nhánh</dt>
            <dd className="font-medium">
              {checkedRecord.attendanceBranchName ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-ink-muted">Ca làm</dt>
            <dd className="font-medium">
              {checkedRecord.workScheduleName ?? "—"}
            </dd>
          </div>
          {totalHours && (
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-ink-muted">Tổng giờ hiện tại</dt>
              <dd className="font-medium">{totalHours}</dd>
            </div>
          )}
          {checkedRecord.lateMinutes != null && (
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-ink-muted">Phút đi muộn</dt>
              <dd className="font-medium">{checkedRecord.lateMinutes} phút</dd>
            </div>
          )}
          {latePenalty && (
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-ink-muted">Phạt đi muộn</dt>
              <dd className="text-right font-medium">{latePenalty}</dd>
            </div>
          )}
        </dl>
        {reviewSubmitted ? (
          <p className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
            Đã gửi yêu cầu, đang chờ quản lý duyệt.
          </p>
        ) : !isPendingApproval ? (
          <Button
            className="mt-4"
            type="button"
            variant="secondary"
            onClick={() => setReviewOpen(true)}
          >
            Xin duyệt / báo ngoại lệ
          </Button>
        ) : null}
        <Button
          className="mt-3"
          onClick={() => router.push("/dashboard/absensi")}
        >
          Hoàn tất
        </Button>

        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
          <DialogContent className="p-6 text-left">
            <DialogTitle>Xin duyệt chấm công</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-ink-muted">
              Yêu cầu được gửi đến quản lý ở trạng thái chờ duyệt; thời gian vừa
              chấm không bị thay đổi.
            </DialogDescription>
            <div className="mt-5 space-y-4">
              <fieldset>
                <legend className="text-sm font-medium">
                  Lý do (có thể chọn nhiều)
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {REVIEW_REASON_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={reviewReasons.includes(option.value)}
                        onChange={() =>
                          setReviewReasons((current) =>
                            current.includes(option.value)
                              ? current.filter(
                                  (reason) => reason !== option.value,
                                )
                              : [...current, option.value],
                          )
                        }
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {reviewReasons.includes("FACE_UNRECOGNIZED") ? (
                <div>
                  <Label>Tài khoản cần ghi nhận lượt chấm</Label>
                  <Select
                    value={reviewTargetEmployeeId}
                    onChange={(event) =>
                      setReviewTargetEmployeeId(event.target.value)
                    }
                  >
                    <option value="">Chọn nhân viên</option>
                    {employees?.items.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} · {employee.employeeNo}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              {reviewReasons.includes("GPS_UNAVAILABLE") ? (
                <div>
                  <Label>Chi nhánh / điểm chấm công</Label>
                  <Select
                    value={reviewBranchLocationId}
                    onChange={(event) =>
                      setReviewBranchLocationId(event.target.value)
                    }
                  >
                    <option value="">Chọn điểm chấm công</option>
                    {eligibleLocations?.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.branchName} · {location.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              {reviewReasons.includes("WRONG_SCHEDULE") ? (
                <div>
                  <Label>Ca làm thay thế</Label>
                  <Select
                    value={reviewWorkScheduleId}
                    onChange={(event) =>
                      setReviewWorkScheduleId(event.target.value)
                    }
                  >
                    <option value="">Chọn ca cần đổi sang</option>
                    {workSchedules?.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.name} · {schedule.startTime}–
                        {schedule.endTime}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-xs text-ink-muted">
                    Khi quản lý duyệt, ca này sẽ được áp vào lượt chấm của ngày
                    hiện tại.
                  </p>
                  {(workSchedules?.find((schedule) => schedule.id === reviewWorkScheduleId)?.secondStartTime ? [0, 1] : [0]).map((index) => (
                    <Select key={index} value={reviewWorkScheduleBranchIds[index] ?? branches?.[0]?.id ?? ""} onChange={(event) => setReviewWorkScheduleBranchIds((current) => { const next = [...current]; next[index] = event.target.value; return next; })}>
                      <option value="">Chọn cửa hàng khung {index + 1}</option>
                      {branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </Select>
                  ))}
                </div>
              ) : null}
              {reviewReasons.includes("MISSED_PUNCH") ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label>
                    <Label>In 1</Label>
                    <input
                      type="time"
                      value={reviewCheckInTime}
                      onChange={(event) =>
                        setReviewCheckInTime(event.target.value)
                      }
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                    />
                  </label>
                  <label>
                    <Label>Out 1</Label>
                    <input
                      type="time"
                      value={reviewCheckOutTime}
                      onChange={(event) =>
                        setReviewCheckOutTime(event.target.value)
                      }
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                    />
                  </label>
                  <label>
                    <Label>In 2</Label>
                    <input
                      type="time"
                      value={reviewCheckIn2Time}
                      onChange={(event) =>
                        setReviewCheckIn2Time(event.target.value)
                      }
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                    />
                  </label>
                  <label>
                    <Label>Out 2</Label>
                    <input
                      type="time"
                      value={reviewCheckOut2Time}
                      onChange={(event) =>
                        setReviewCheckOut2Time(event.target.value)
                      }
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                    />
                  </label>
                  <p className="col-span-2 text-xs text-ink-muted sm:col-span-4">
                    Ca thường dùng In 1/Out 1; ca gãy có thể bổ sung In 2/Out 2.
                  </p>
                </div>
              ) : null}
              <div>
                <Label>Nội dung giải trình</Label>
                <textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  minLength={5}
                  maxLength={1000}
                  placeholder="Ví dụ: Hôm nay làm thay ca chiều theo phân công của quản lý."
                  className="min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Ảnh chứng minh (tùy chọn, tối đa 5 ảnh)</Label>
                <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-canvas px-3 py-4 text-sm font-medium text-ink-muted hover:bg-canvas/70">
                  <Camera className="mr-2 size-4" />
                  Tải lên / chụp ảnh chứng minh
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="sr-only"
                    onChange={(event) =>
                      addReviewEvidencePhotos(event.target.files)
                    }
                  />
                </label>
                {reviewEvidencePhotos.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {reviewEvidencePhotos.map((photo, index) => (
                      <div
                        key={`${photo.slice(-16)}-${index}`}
                        className="relative overflow-hidden rounded-lg border border-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo}
                          alt={`Ảnh chứng minh ${index + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded bg-ink/75 px-1.5 py-0.5 text-xs text-white"
                          onClick={() =>
                            setReviewEvidencePhotos((photos) =>
                              photos.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted">
                    Có thể bổ sung khi quản lý yêu cầu. Ảnh này tách riêng với
                    ảnh camera khi chấm.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Hủy
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  disabled={
                    requestApproval.isPending ||
                    !reviewReasons.length ||
                    reviewNote.trim().length < 5 ||
                    (reviewReasons.includes("FACE_UNRECOGNIZED") &&
                      !reviewTargetEmployeeId) ||
                    (reviewReasons.includes("GPS_UNAVAILABLE") &&
                      !reviewBranchLocationId) ||
                    (reviewReasons.includes("WRONG_SCHEDULE") &&
                      !reviewWorkScheduleId) ||
                    (reviewReasons.includes("MISSED_PUNCH") &&
                      !reviewCheckInTime &&
                      !reviewCheckOutTime &&
                      !reviewCheckIn2Time &&
                      !reviewCheckOut2Time)
                  }
                  onClick={submitReviewRequest}
                >
                  {requestApproval.isPending ? "Đang gửi…" : "Gửi xin duyệt"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-border bg-ink/90">
        <video
          ref={videoRef}
          className="h-full w-full -scale-x-100 object-cover"
          muted
          playsInline
        />
        <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/40" />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute bottom-3 right-3"
          onClick={changeCamera}
          aria-label="Đổi camera"
        >
          <SwitchCamera />
        </Button>
      </div>
      <div className="flex min-h-6 items-center justify-center gap-2 text-center text-sm">
        {phase === "liveness" && challenge && (
          <Badge tone="purple">{CHALLENGE_LABEL[challenge]}</Badge>
        )}
        <span className="text-ink-muted">{hint}</span>
      </div>
      {(cameraError || locationError) && (
        <p className="text-center text-sm text-red-600">
          {cameraError || locationError}
        </p>
      )}
      {eligibleLocations?.[0] && (
        <p className="text-center text-xs text-ink-muted">
          Điểm chấm: {eligibleLocations[0].branchName} ·{" "}
          {eligibleLocations[0].name} · {eligibleLocations[0].radiusMeters} m
        </p>
      )}
      {coords && (
        <p className="text-center text-xs text-ink-subtle">
          GPS sai số khoảng ±{Math.round(coords.accuracyMeters)} m
        </p>
      )}
      <div className="flex justify-center gap-3">
        {(phase === "error" || cameraError || locationError) && (
          <Button onClick={tryAgain} variant="secondary">
            <RefreshCw /> Thử lại
          </Button>
        )}
        {phase === "submitting" && (
          <Button disabled>
            <Loader2 className="animate-spin" /> Đang xác minh…
          </Button>
        )}
        {phase === "done" && (
          <Button onClick={() => router.push("/dashboard/absensi")}>
            Hoàn tất
          </Button>
        )}
      </div>
      {phase === "error" && suggestBorrowedAttendance && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">
            Có phải đang chấm hộ?
          </h3>
          <p className="mt-1 text-sm text-amber-900">
            Khuôn mặt này không khớp với tài khoản đang đăng nhập. Chỉ xác nhận
            nếu nhân viên quên điện thoại và đồng ý dùng thiết bị này.
          </p>
          <Button
            className="mt-3"
            type="button"
            variant="secondary"
            onClick={acceptBorrowedAttendance}
          >
            Xác nhận chấm hộ người được nhận diện
          </Button>
        </section>
      )}
      {phase === "error" && failedAttempts < 2 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">
            Xác minh chưa thành công
          </h3>
          <p className="mt-1 text-sm text-amber-900">
            Hãy thử chấm tự động thêm {2 - failedAttempts} lần trước khi dùng
            chấm công thủ công.
          </p>
        </section>
      )}
      {phase === "error" && failedAttempts >= 2 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Chấm công thủ công</h3>
          <p className="mt-1 text-sm text-amber-900">
            Đã có 2 lần xác minh tự động không thành công. Phiên chấm thủ công
            sẽ ở trạng thái chờ duyệt.
          </p>
          {approvalEmployeeId || canManage ? (
            <div className="mt-3 space-y-3">
              {canManage && !approvalEmployeeId ? (
                <label className="block text-sm font-medium text-ink">
                  Nhân viên
                  <select
                    value={manualEmployeeId}
                    onChange={(event) =>
                      setManualEmployeeId(event.target.value)
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                  >
                    <option value="">Chọn nhân viên</option>
                    {employees?.items.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} · {employee.employeeNo}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {(manualPhoto ?? lastPhotoRef.current) ? (
                  // Camera captures are temporary browser data URLs, which next/image cannot optimize.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={manualPhoto ?? lastPhotoRef.current}
                    alt="Ảnh chấm công thủ công"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-sm text-ink-muted">
                    Chưa có ảnh chấm công
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={captureManualPhoto}
              >
                <Camera /> Chụp ảnh minh chứng
              </Button>
              <label className="block text-sm font-medium text-ink">
                Ca làm
                <select
                  value={manualScheduleId}
                  onChange={(event) => setManualScheduleId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                >
                  <option value="">Chọn ca làm</option>
                  {workSchedules?.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.name} · {schedule.startTime}–{schedule.endTime}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-ink">
                Lý do chấm thủ công
                <textarea
                  value={manualReason}
                  onChange={(event) => setManualReason(event.target.value)}
                  minLength={5}
                  maxLength={1000}
                  placeholder="Ví dụ: Camera không nhận diện được khuôn mặt sau 2 lần thử."
                  className="mt-1 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                />
              </label>
              {manualError ? (
                <p className="text-sm text-red-600">{manualError}</p>
              ) : null}
              <Button
                className="w-full"
                onClick={sendManualAttendance}
                disabled={manualAttendance.isPending}
              >
                <Send />{" "}
                {manualAttendance.isPending
                  ? "Đang gửi…"
                  : "Gửi chấm công thủ công"}
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-900">
              Hãy đăng nhập bằng tài khoản nhân viên để chấm công thủ công cho
              chính mình.
            </p>
          )}
        </section>
      )}
      {phase === "done" &&
        kind === "check-out" &&
        checkedRecord?.overtime?.canRequest && (
          <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <h3 className="font-semibold text-violet-950">Làm thêm</h3>
            <p className="mt-1 text-sm text-violet-900">
              Bạn chấm ra muộn hơn ca {checkedRecord.overtime.eligibleMinutes}{" "}
              phút. Hãy nhập lý do để quản lý duyệt tăng ca.
            </p>
            <label className="mt-3 block text-sm font-medium text-ink">
              Lý do làm thêm
              <textarea
                value={overtimeReason}
                onChange={(e) => setOvertimeReason(e.target.value)}
                minLength={5}
                maxLength={1000}
                className="mt-1 min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                placeholder="Ví dụ: Hoàn tất bàn giao cuối ca"
              />
            </label>
            <Button
              className="mt-3 w-full"
              onClick={sendOvertimeRequest}
              disabled={
                requestOvertime.isPending || overtimeReason.trim().length < 5
              }
            >
              <Send />{" "}
              {requestOvertime.isPending ? "Đang gửi…" : "Gửi yêu cầu làm thêm"}
            </Button>
          </section>
        )}
      <p className="text-center text-xs text-ink-subtle">
        Camera tự chụp ảnh audit sau khi xác minh. Không cần bấm chụp hoặc xác
        nhận.
      </p>
    </div>
  );
}

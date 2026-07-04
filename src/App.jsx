import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Home,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Umbrella,
  User,
  Users,
} from "lucide-react";
import "./index.css";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzuaVTSvbaffF6uGu63JvejokvjrUyrs4qxNJ5bI_qQRZuJbbkNDlUbSS2ztLI-7o0x/exec";

const MENU = [
  { key: "dashboard", label: "대시보드", icon: Home },
  { key: "calendar", label: "월별 달력", icon: CalendarDays },
  { key: "employees", label: "직원 현황", icon: Users },
  { key: "leave", label: "연차 사용 관리", icon: CalendarDays },
  { key: "holiday", label: "공휴일 근무 관리", icon: ShieldCheck },
  { key: "vacation", label: "휴가 차감 관리", icon: Umbrella },
  { key: "adjust", label: "연차 조정 관리", icon: ClipboardList },
  { key: "settings", label: "설정", icon: Settings },
];

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

const SUPPLEMENTAL_PUBLIC_HOLIDAYS = {
  2026: [
    { date: "2026-05-01", title: "노동절" },
    { date: "2026-06-03", title: "제9회 전국동시지방선거" },
    { date: "2026-07-17", title: "제헌절" },
  ],
};

function todayMonth() {
  return new Date().getMonth() + 1;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDate(dateString) {
  if (!dateString) return "";
  return String(dateString).slice(0, 10);
}

function getMonthFromDate(dateString) {
  if (!dateString) return 0;
  return Number(String(dateString).slice(5, 7));
}

function getYearFromDate(dateString) {
  if (!dateString) return 0;
  return Number(String(dateString).slice(0, 4));
}

function isDateBetween(dateString, startString, endString) {
  const date = formatDate(dateString);
  const start = formatDate(startString);
  const end = formatDate(endString || startString);

  if (!date || !start || !end) return false;

  return date >= start && date <= end;
}

function isDateRangeInMonth(startString, endString, year, month) {
  const start = formatDate(startString);
  const end = formatDate(endString || startString);

  if (!start || !end) return false;

  const monthStart = `${year}-${pad2(month)}-01`;
  const monthEnd = `${year}-${pad2(month)}-${pad2(getDaysInMonth(year, month))}`;

  return start <= monthEnd && end >= monthStart;
}

function mergeSupplementalPublicHolidays(publicHolidays, year) {
  const supplemental = SUPPLEMENTAL_PUBLIC_HOLIDAYS[year] || EMPTY_ARRAY;
  const merged = [...publicHolidays];
  const existingKeys = new Set(
    publicHolidays.map((row) => `${formatDate(row.date)}-${row.title}`)
  );

  supplemental.forEach((holiday) => {
    const key = `${holiday.date}-${holiday.title}`;

    if (!existingKeys.has(key)) {
      merged.push(holiday);
    }
  });

  return merged;
}

function getCompletedMonthlyLeaveCount(joinDateString, targetDateString) {
  const joinDate = formatDate(joinDateString);
  const targetDate = formatDate(targetDateString);

  if (!joinDate || !targetDate || targetDate < joinDate) return 0;

  const joinYear = getYearFromDate(joinDate);
  const joinMonth = getMonthFromDate(joinDate);
  const joinDay = Number(joinDate.slice(8, 10));
  const targetYear = getYearFromDate(targetDate);
  const targetMonth = getMonthFromDate(targetDate);
  const targetDay = Number(targetDate.slice(8, 10));
  let completedMonths = (targetYear - joinYear) * 12 + (targetMonth - joinMonth);

  if (targetDay < joinDay) {
    completedMonths -= 1;
  }

  return Math.max(0, Math.min(11, completedMonths));
}

function projectEmployeeLeaveToYearEnd(employees, year) {
  const targetDate = `${year}-12-31`;

  return employees.map((emp) => {
    if (getYearFromDate(emp.joinDate) !== year) {
      return emp;
    }

    const projectedBaseLeave = getCompletedMonthlyLeaveCount(emp.joinDate, targetDate);
    const currentBaseLeave = Number(emp.baseLeave || 0);

    if (projectedBaseLeave <= currentBaseLeave) {
      return emp;
    }

    const adjustmentDays = Number(emp.adjustmentDays || 0);
    const vacationDeductionDays = Number(emp.vacationDeductionDays || 0);
    const usedLeave = Number(emp.usedLeave || 0);
    const totalLeave = projectedBaseLeave + adjustmentDays - vacationDeductionDays;

    return {
      ...emp,
      baseLeave: projectedBaseLeave,
      totalLeave,
      remainingLeave: totalLeave - usedLeave,
    };
  });
}

function makeProjectedKpi(kpi, employees) {
  const totalLeave = employees.reduce((sum, row) => sum + Number(row.totalLeave || 0), 0);
  const usedLeave = employees.reduce((sum, row) => sum + Number(row.usedLeave || 0), 0);
  const remainingLeave = employees.reduce((sum, row) => sum + Number(row.remainingLeave || 0), 0);

  return {
    ...kpi,
    totalLeave,
    usedLeave,
    remainingLeave,
    usedRate: totalLeave > 0 ? Math.round((usedLeave / totalLeave) * 1000) / 10 : 0,
    remainingRate: totalLeave > 0 ? Math.round((remainingLeave / totalLeave) * 1000) / 10 : 0,
  };
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayIndex(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

function makeEmptyEmployeeForm() {
  return {
    employeeId: "",
    employeeName: "",
    joinDate: "",
    status: "재직",
    memo: "",
  };
}

function makeEmptyLeaveForm() {
  return {
    useId: "",
    employeeId: "",
    useDate: "",
    reason: "개인 사유",
    memo: "",
  };
}

function makeEmptyHolidayForm() {
  return {
    workId: "",
    targetType: "개별",
    employeeId: "",
    workDate: "",
    holidayName: "",
    memo: "",
  };
}

function makeEmptyVacationForm() {
  return {
    deductionId: "",
    startDate: "",
    endDate: "",
    deductionDays: "",
    targetType: "전체",
    employeeId: "",
    memo: "",
  };
}

function makeEmptyAdjustmentForm() {
  return {
    adjustmentId: "",
    employeeId: "",
    applyDate: "",
    adjustmentType: "수동조정",
    adjustmentDays: 1,
    content: "",
    memo: "",
  };
}

async function api(action, payload = {}) {
  const response = await fetch(`${API_URL}?action=${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "API 오류가 발생했습니다.");
  }

  return result.data;
}

function App() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(todayMonth());
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");

  const [employeeForm, setEmployeeForm] = useState(makeEmptyEmployeeForm());
  const [leaveForm, setLeaveForm] = useState(makeEmptyLeaveForm());
  const [holidayForm, setHolidayForm] = useState(makeEmptyHolidayForm());
  const [vacationForm, setVacationForm] = useState(makeEmptyVacationForm());
  const [adjustmentForm, setAdjustmentForm] = useState(makeEmptyAdjustmentForm());

  const [editingEmployeeId, setEditingEmployeeId] = useState("");
  const [editingUseId, setEditingUseId] = useState("");
  const [editingWorkId, setEditingWorkId] = useState("");
  const [editingDeductionId, setEditingDeductionId] = useState("");
  const [editingAdjustmentId, setEditingAdjustmentId] = useState("");

  const apiEmployees = dashboard?.employees ?? EMPTY_ARRAY;
  const employees = useMemo(
    () => projectEmployeeLeaveToYearEnd(apiEmployees, selectedYear),
    [apiEmployees, selectedYear]
  );
  const leaveUses = dashboard?.leaveUses ?? EMPTY_ARRAY;
  const adjustments = dashboard?.adjustments ?? EMPTY_ARRAY;
  const holidayWorks = dashboard?.holidayWorks ?? EMPTY_ARRAY;
  const vacationDeductions = dashboard?.vacationDeductions ?? EMPTY_ARRAY;
  const apiPublicHolidays = dashboard?.publicHolidays ?? EMPTY_ARRAY;
  const publicHolidays = useMemo(
    () => mergeSupplementalPublicHolidays(apiPublicHolidays, selectedYear),
    [apiPublicHolidays, selectedYear]
  );
  const apiKpi = dashboard?.kpi ?? EMPTY_OBJECT;
  const kpi = useMemo(() => makeProjectedKpi(apiKpi, employees), [apiKpi, employees]);

  async function loadDashboard(year = selectedYear) {
    try {
      setLoading(true);
      setError("");
      const data = await api("getDashboard", { year });
      setDashboard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard(selectedYear);
  }, [selectedYear]);

  const selectedEmployeeForLeave = employees.find(
    (emp) => emp.employeeId === leaveForm.employeeId
  );

  const selectedEmployeeForHoliday = employees.find(
    (emp) => emp.employeeId === holidayForm.employeeId
  );

  const selectedEmployeeForVacation = employees.find(
    (emp) => emp.employeeId === vacationForm.employeeId
  );

  const selectedEmployeeForAdjustment = employees.find(
    (emp) => emp.employeeId === adjustmentForm.employeeId
  );

  const monthLeaveUses = useMemo(() => {
    return leaveUses.filter(
      (row) =>
        getYearFromDate(row["사용일자"]) === selectedYear &&
        getMonthFromDate(row["사용일자"]) === selectedMonth
    );
  }, [leaveUses, selectedYear, selectedMonth]);

  const monthHolidayWorks = useMemo(() => {
    return holidayWorks.filter(
      (row) =>
        getYearFromDate(row["근무일자"]) === selectedYear &&
        getMonthFromDate(row["근무일자"]) === selectedMonth
    );
  }, [holidayWorks, selectedYear, selectedMonth]);

  const monthVacationDeductions = useMemo(() => {
    return vacationDeductions.filter((row) => {
      return isDateRangeInMonth(row["시작일"], row["종료일"], selectedYear, selectedMonth);
    });
  }, [vacationDeductions, selectedYear, selectedMonth]);

  const monthPublicHolidays = useMemo(() => {
    return publicHolidays.filter(
      (row) =>
        getYearFromDate(row.date) === selectedYear &&
        getMonthFromDate(row.date) === selectedMonth
    );
  }, [publicHolidays, selectedYear, selectedMonth]);

  async function handleAdminLogin() {
    try {
      const data = await api("checkAdminPassword", {
        password: adminPassword,
      });

      if (data.isAdmin) {
        setAdminMode(true);
        setAdminPassword("");
        alert("관리자 모드로 전환되었습니다.");
      } else {
        alert("비밀번호가 맞지 않습니다.");
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSaveEmployee(e) {
    e.preventDefault();

    if (!employeeForm.employeeName || !employeeForm.joinDate) {
      alert("직원명과 입사일을 입력해주세요.");
      return;
    }

    try {
      if (editingEmployeeId) {
        await api("updateEmployee", employeeForm);
        alert("직원 정보가 수정되었습니다.");
      } else {
        await api("addEmployee", employeeForm);
        alert("직원이 추가되었습니다.");
      }

      setEmployeeForm(makeEmptyEmployeeForm());
      setEditingEmployeeId("");
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  function startEditEmployee(emp) {
    setEditingEmployeeId(emp.employeeId);
    setEmployeeForm({
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      joinDate: emp.joinDate,
      status: emp.status || "재직",
      memo: emp.memo || "",
    });
  }

  async function handleDeleteEmployee(employeeId) {
    if (!confirm("이 직원을 삭제할까요? 기존 사용 내역은 남아있습니다.")) return;

    try {
      await api("deleteEmployee", { employeeId });
      await loadDashboard();
      alert("직원이 삭제되었습니다.");
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSaveLeaveUse(e) {
    e.preventDefault();

    if (!leaveForm.employeeId || !leaveForm.useDate) {
      alert("직원과 사용일자를 선택해주세요.");
      return;
    }

    try {
      const payload = {
        useId: leaveForm.useId,
        employeeId: leaveForm.employeeId,
        employeeName: selectedEmployeeForLeave?.employeeName || "",
        useDate: leaveForm.useDate,
        useDays: 1,
        reason: leaveForm.reason,
        memo: leaveForm.memo,
      };

      if (editingUseId) {
        await api("updateLeaveUse", payload);
        alert("연차 사용 내역이 수정되었습니다.");
      } else {
        await api("addLeaveUse", payload);
        alert("연차 사용이 등록되었습니다.");
      }

      setLeaveForm(makeEmptyLeaveForm());
      setEditingUseId("");
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  function startEditLeaveUse(row) {
    setEditingUseId(row["사용ID"]);
    setLeaveForm({
      useId: row["사용ID"],
      employeeId: row["직원ID"],
      useDate: row["사용일자"],
      reason: row["사유"] || "개인 사유",
      memo: row["메모"] || "",
    });
  }

  async function handleDeleteLeave(useId) {
    if (!confirm("이 연차 사용 내역을 삭제할까요?")) return;

    try {
      await api("deleteLeaveUse", { useId });
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSaveHolidayWork(e) {
    e.preventDefault();

    if (!holidayForm.workDate) {
      alert("근무일자를 선택해주세요.");
      return;
    }

    if (holidayForm.targetType === "개별" && !holidayForm.employeeId) {
      alert("개별 직원 적용 시 직원을 선택해주세요.");
      return;
    }

    try {
      const payload = {
        workId: holidayForm.workId,
        targetType: holidayForm.targetType,
        employeeId: holidayForm.targetType === "개별" ? holidayForm.employeeId : "",
        employeeName:
          holidayForm.targetType === "개별"
            ? selectedEmployeeForHoliday?.employeeName || ""
            : "",
        workDate: holidayForm.workDate,
        holidayName: holidayForm.holidayName,
        earnDays: 1,
        memo: holidayForm.memo,
      };

      if (editingWorkId) {
        await api("updateHolidayWork", payload);
        alert("공휴일 근무 내역이 수정되었습니다.");
      } else {
        const result = await api("addHolidayWork", payload);

        if (holidayForm.targetType === "전체") {
          alert(
            `공휴일 근무가 전체 직원 ${result.count || 0}명에게 등록되었습니다. 각 직원에게 +1일이 자동 반영됩니다.`
          );
        } else {
          alert("공휴일 근무가 등록되었습니다. 연차 +1일이 자동 반영됩니다.");
        }
      }

      setHolidayForm(makeEmptyHolidayForm());
      setEditingWorkId("");
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  function startEditHolidayWork(row) {
    setEditingWorkId(row["근무ID"]);
    setHolidayForm({
      workId: row["근무ID"],
      targetType: "개별",
      employeeId: row["직원ID"],
      workDate: row["근무일자"],
      holidayName: row["공휴일명"] || "",
      memo: row["메모"] || "",
    });
  }

  async function handleDeleteHoliday(workId) {
    if (
      !confirm(
        "이 공휴일 근무 내역을 삭제할까요? 연결된 +1 조정도 같이 삭제됩니다."
      )
    )
      return;

    try {
      await api("deleteHolidayWork", { workId });
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSaveVacationDeduction(e) {
    e.preventDefault();

    const deductionDays = Number(vacationForm.deductionDays);

    if (!vacationForm.startDate || !vacationForm.endDate) {
      alert("시작일과 종료일을 입력해주세요.");
      return;
    }

    if (!deductionDays || deductionDays <= 0) {
      alert("차감 일수를 1일 이상으로 입력해주세요.");
      return;
    }

    if (vacationForm.targetType === "개별" && !vacationForm.employeeId) {
      alert("개별 직원 적용 시 직원을 선택해주세요.");
      return;
    }

    try {
      const payload = {
        deductionId: vacationForm.deductionId,
        startDate: vacationForm.startDate,
        endDate: vacationForm.endDate,
        deductionDays,
        targetType: vacationForm.targetType,
        employeeId:
          vacationForm.targetType === "개별" ? vacationForm.employeeId : "",
        employeeName:
          vacationForm.targetType === "개별"
            ? selectedEmployeeForVacation?.employeeName || ""
            : "",
        memo: vacationForm.memo,
      };

      if (editingDeductionId) {
        await api("updateVacationDeduction", payload);
        alert("휴가 차감 내역이 수정되었습니다.");
      } else {
        await api("addVacationDeduction", payload);
        alert("휴가 차감이 등록되었습니다.");
      }

      setVacationForm(makeEmptyVacationForm());
      setEditingDeductionId("");
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  function startEditVacationDeduction(row) {
    setEditingDeductionId(row["차감ID"]);
    setVacationForm({
      deductionId: row["차감ID"],
      startDate: row["시작일"],
      endDate: row["종료일"],
      deductionDays: row["차감일수"] || "",
      targetType: row["적용대상"] || "전체",
      employeeId: row["직원ID"] || "",
      memo: row["메모"] || "",
    });
  }

  async function handleDeleteVacation(deductionId) {
    if (!confirm("이 휴가 차감 내역을 삭제할까요?")) return;

    try {
      await api("deleteVacationDeduction", { deductionId });
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSaveAdjustment(e) {
    e.preventDefault();

    if (!adjustmentForm.employeeId || !adjustmentForm.applyDate) {
      alert("직원과 적용일자를 선택해주세요.");
      return;
    }

    try {
      const payload = {
        adjustmentId: adjustmentForm.adjustmentId,
        employeeId: adjustmentForm.employeeId,
        employeeName: selectedEmployeeForAdjustment?.employeeName || "",
        applyDate: adjustmentForm.applyDate,
        adjustmentType: adjustmentForm.adjustmentType,
        adjustmentDays: Number(adjustmentForm.adjustmentDays),
        content: adjustmentForm.content,
        memo: adjustmentForm.memo,
      };

      if (editingAdjustmentId) {
        await api("updateAdjustment", payload);
        alert("연차 조정 내역이 수정되었습니다.");
      } else {
        await api("addAdjustment", payload);
        alert("연차 조정 내역이 등록되었습니다.");
      }

      setAdjustmentForm(makeEmptyAdjustmentForm());
      setEditingAdjustmentId("");
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  function startEditAdjustment(row) {
    setEditingAdjustmentId(row["조정ID"]);
    setAdjustmentForm({
      adjustmentId: row["조정ID"],
      employeeId: row["직원ID"],
      applyDate: row["적용일자"],
      adjustmentType: row["조정구분"] || "수동조정",
      adjustmentDays: row["조정일수"] || 1,
      content: row["내용"] || "",
      memo: row["메모"] || "",
    });
  }

  async function handleDeleteAdjustment(adjustmentId, adjustmentType) {
    if (adjustmentType === "공휴일근무") {
      alert("공휴일근무 자동 조정은 공휴일 근무 관리에서 삭제해주세요.");
      return;
    }

    if (!confirm("이 연차 조정 내역을 삭제할까요?")) return;

    try {
      await api("deleteAdjustment", { adjustmentId });
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  function resetAllForms() {
    setEmployeeForm(makeEmptyEmployeeForm());
    setLeaveForm(makeEmptyLeaveForm());
    setHolidayForm(makeEmptyHolidayForm());
    setVacationForm(makeEmptyVacationForm());
    setAdjustmentForm(makeEmptyAdjustmentForm());
    setEditingEmployeeId("");
    setEditingUseId("");
    setEditingWorkId("");
    setEditingDeductionId("");
    setEditingAdjustmentId("");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-title">ABLE & CO</div>
          <div className="brand-subtitle">Employee Leave Management</div>
        </div>

        <nav className="menu">
          {MENU.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                className={`menu-item ${activeMenu === item.key ? "active" : ""}`}
                onClick={() => {
                  setActiveMenu(item.key);
                  resetAllForms();
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="quick-box">
          <div className="quick-title">Quick Actions</div>
          <button className="quick-btn" onClick={() => setActiveMenu("leave")}>
            <Plus size={16} />
            연차 사용 등록
          </button>
          <button className="quick-btn" onClick={() => setActiveMenu("holiday")}>
            <Plus size={16} />
            공휴일 근무 등록
          </button>
          <button className="quick-btn" onClick={() => setActiveMenu("vacation")}>
            <Plus size={16} />
            휴가 차감 등록
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              <Sparkles size={16} />
              ABLE & CO HR SYSTEM
            </div>
            <h1>직원 연차 관리 대시보드</h1>
            <p>
              입사일 기준 자동 연차 계산, 공휴일 근무 적립, 휴가 차감,
              월별 사용 현황을 한 화면에서 관리합니다.
            </p>
          </div>

          <div className="top-actions">
            <button
              className="year-btn"
              onClick={() => setSelectedYear((prev) => prev - 1)}
            >
              <ChevronLeft size={18} />
            </button>

            <select
              className="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {Array.from({ length: 10 }).map((_, index) => {
                const year = 2026 + index;
                return (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                );
              })}
            </select>

            <button
              className="year-btn"
              onClick={() => setSelectedYear((prev) => prev + 1)}
            >
              <ChevronRight size={18} />
            </button>

            <button className="icon-btn" onClick={() => loadDashboard()}>
              <RefreshCw size={18} />
            </button>

            <button className="icon-btn">
              <Bell size={18} />
            </button>

            <div className="admin-box">
              <User size={18} />
              <span>{adminMode ? "관리자 모드" : "조회 모드"}</span>
            </div>
          </div>
        </header>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <div className="loading-box">데이터를 불러오는 중입니다...</div>
        ) : (
          <>
            <KpiSection kpi={kpi} />

            {activeMenu === "dashboard" && (
              <DashboardView
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                employees={employees}
                leaveUses={leaveUses}
                adjustments={adjustments}
                monthLeaveUses={monthLeaveUses}
                monthHolidayWorks={monthHolidayWorks}
                monthVacationDeductions={monthVacationDeductions}
                monthPublicHolidays={monthPublicHolidays}
              />
            )}

            {activeMenu === "calendar" && (
              <CalendarOnlyView
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                employees={employees}
                monthLeaveUses={monthLeaveUses}
                monthHolidayWorks={monthHolidayWorks}
                monthVacationDeductions={monthVacationDeductions}
                monthPublicHolidays={monthPublicHolidays}
              />
            )}

            {activeMenu === "employees" && (
              <EmployeesView
                employees={employees}
                adminMode={adminMode}
                employeeForm={employeeForm}
                setEmployeeForm={setEmployeeForm}
                handleSaveEmployee={handleSaveEmployee}
                startEditEmployee={startEditEmployee}
                handleDeleteEmployee={handleDeleteEmployee}
                editingEmployeeId={editingEmployeeId}
                cancelEdit={() => {
                  setEmployeeForm(makeEmptyEmployeeForm());
                  setEditingEmployeeId("");
                }}
              />
            )}

            {activeMenu === "leave" && (
              <LeaveUseView
                employees={employees}
                leaveUses={leaveUses}
                adminMode={adminMode}
                leaveForm={leaveForm}
                setLeaveForm={setLeaveForm}
                handleSaveLeaveUse={handleSaveLeaveUse}
                startEditLeaveUse={startEditLeaveUse}
                handleDeleteLeave={handleDeleteLeave}
                editingUseId={editingUseId}
                cancelEdit={() => {
                  setLeaveForm(makeEmptyLeaveForm());
                  setEditingUseId("");
                }}
              />
            )}

            {activeMenu === "holiday" && (
              <HolidayWorkView
                employees={employees}
                holidayWorks={holidayWorks}
                adminMode={adminMode}
                holidayForm={holidayForm}
                setHolidayForm={setHolidayForm}
                handleSaveHolidayWork={handleSaveHolidayWork}
                startEditHolidayWork={startEditHolidayWork}
                handleDeleteHoliday={handleDeleteHoliday}
                editingWorkId={editingWorkId}
                cancelEdit={() => {
                  setHolidayForm(makeEmptyHolidayForm());
                  setEditingWorkId("");
                }}
              />
            )}

            {activeMenu === "vacation" && (
              <VacationDeductionView
                employees={employees}
                vacationDeductions={vacationDeductions}
                adminMode={adminMode}
                vacationForm={vacationForm}
                setVacationForm={setVacationForm}
                handleSaveVacationDeduction={handleSaveVacationDeduction}
                startEditVacationDeduction={startEditVacationDeduction}
                handleDeleteVacation={handleDeleteVacation}
                editingDeductionId={editingDeductionId}
                cancelEdit={() => {
                  setVacationForm(makeEmptyVacationForm());
                  setEditingDeductionId("");
                }}
              />
            )}

            {activeMenu === "adjust" && (
              <AdjustView
                employees={employees}
                adjustments={adjustments}
                adminMode={adminMode}
                adjustmentForm={adjustmentForm}
                setAdjustmentForm={setAdjustmentForm}
                handleSaveAdjustment={handleSaveAdjustment}
                startEditAdjustment={startEditAdjustment}
                handleDeleteAdjustment={handleDeleteAdjustment}
                editingAdjustmentId={editingAdjustmentId}
                cancelEdit={() => {
                  setAdjustmentForm(makeEmptyAdjustmentForm());
                  setEditingAdjustmentId("");
                }}
              />
            )}

            {activeMenu === "settings" && (
              <SettingsView
                adminMode={adminMode}
                adminPassword={adminPassword}
                setAdminPassword={setAdminPassword}
                handleAdminLogin={handleAdminLogin}
                setAdminMode={setAdminMode}
              />
            )}
          </>
        )}

        <footer className="footer">
          ABLE & CO 연차 관리 시스템 ㅣ © {selectedYear} ABLE & CO.
        </footer>
      </main>
    </div>
  );
}

function KpiSection({ kpi }) {
  const cards = [
    {
      label: "전체 직원",
      value: `${kpi.totalEmployees || 0}명`,
      sub: "재직 기준",
      icon: Users,
      color: "blue",
    },
    {
      label: "총 연차 일수",
      value: `${kpi.totalLeave || 0}일`,
      sub: "자동 계산",
      icon: CalendarDays,
      color: "green",
    },
    {
      label: "사용 연차",
      value: `${kpi.usedLeave || 0}일`,
      sub: `${kpi.usedRate || 0}% 사용`,
      icon: User,
      color: "blue",
    },
    {
      label: "남은 연차",
      value: `${kpi.remainingLeave || 0}일`,
      sub: `${kpi.remainingRate || 0}% 잔여`,
      icon: RefreshCw,
      color: "green",
    },
    {
      label: "공휴일 근무 적립",
      value: `${kpi.holidayWorkDays || 0}일`,
      sub: "+1일 적립",
      icon: ShieldCheck,
      color: "orange",
    },
    {
      label: "휴가 차감",
      value: `-${Math.abs(kpi.vacationDeductionTotal || 0)}일`,
      sub: "회사 휴가",
      icon: Umbrella,
      color: "red",
    },
  ];

  return (
    <section className="kpi-grid">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div className="kpi-card" key={card.label}>
            <div className={`kpi-icon ${card.color}`}>
              <Icon size={28} />
            </div>
            <div>
              <div className="kpi-label">{card.label}</div>
              <div className="kpi-value">
                {card.value}
                {card.sub && <span>{card.sub}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function DashboardView({
  selectedYear,
  selectedMonth,
  setSelectedMonth,
  employees,
  leaveUses,
  adjustments,
  monthLeaveUses,
  monthHolidayWorks,
  monthVacationDeductions,
  monthPublicHolidays,
}) {
  return (
    <div className="dashboard-grid">
      <section className="panel large">
        <div className="panel-header">
          <div>
            <h2>직원 연차 현황</h2>
            <p className="section-desc">{selectedYear}년 기준 자동 계산</p>
          </div>
          <span className="premium-badge">LIVE</span>
        </div>

        <EmployeeTable employees={employees} showActions={false} />

        <p className="panel-note">
          ※ 현재 근속은 한국 오늘 날짜 기준, 기본연차는 선택 연도 말까지의 예상 발생분입니다.
        </p>
      </section>

      <section className="panel large">
        <CalendarPanel
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          employees={employees}
          monthLeaveUses={monthLeaveUses}
          monthHolidayWorks={monthHolidayWorks}
          monthVacationDeductions={monthVacationDeductions}
          monthPublicHolidays={monthPublicHolidays}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>최근 연차 사용</h2>
            <p className="section-desc">최신 등록순</p>
          </div>
        </div>

        <SimpleTable
          headers={["날짜", "직원명", "사용", "사유"]}
          rows={leaveUses.slice(0, 5).map((row) => [
            row["사용일자"],
            row["직원명"],
            `${row["사용일수"]}일`,
            row["사유"],
          ])}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>최근 조정 내역</h2>
            <p className="section-desc">공휴일 근무 및 수동 조정</p>
          </div>
        </div>

        <SimpleTable
          headers={["일자", "직원명", "구분", "일수", "내용"]}
          rows={adjustments.slice(0, 5).map((row) => [
            row["적용일자"],
            row["직원명"],
            row["조정구분"],
            `${Number(row["조정일수"]) > 0 ? "+" : ""}${row["조정일수"]}일`,
            row["내용"],
          ])}
        />
      </section>

      <section className="panel summary">
        <div className="panel-header">
          <div>
            <h2>연차 현황 요약</h2>
            <p className="section-desc">{selectedYear}년 전체 직원 합계</p>
          </div>
        </div>

        <div className="donut">
          <div>
            <strong>남은 연차</strong>
            <b>
              {employees.reduce((sum, row) => sum + Number(row.remainingLeave || 0), 0)}
              일
            </b>
          </div>
        </div>

        <div className="summary-list">
          <div>
            <span className="dot blue"></span> 사용 연차
            <b>{employees.reduce((sum, row) => sum + Number(row.usedLeave || 0), 0)}일</b>
          </div>
          <div>
            <span className="dot green"></span> 남은 연차
            <b>{employees.reduce((sum, row) => sum + Number(row.remainingLeave || 0), 0)}일</b>
          </div>
          <div>
            <span className="dot red"></span> 휴가 차감
            <b>
              -
              {Math.abs(
                employees.reduce((sum, row) => sum + Number(row.vacationDeductionDays || 0), 0)
              )}
              일
            </b>
          </div>
        </div>
      </section>
    </div>
  );
}

function EmployeeTable({
  employees,
  showActions = false,
  adminMode = false,
  startEditEmployee,
  handleDeleteEmployee,
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>직원명</th>
            <th>상태</th>
            <th>입사일</th>
            <th>현재 근속</th>
            <th>기본연차</th>
            <th>조정</th>
            <th>휴가차감</th>
            <th>사용</th>
            <th>잔여</th>
            {showActions && <th>관리</th>}
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 ? (
            <tr>
              <td colSpan={showActions ? 10 : 9} className="empty-cell">
                직원 데이터가 없습니다.
              </td>
            </tr>
          ) : (
            employees.map((emp) => (
              <tr key={emp.employeeId}>
                <td className="employee-name">{emp.employeeName}</td>
                <td>
                  <span className="status-badge">{emp.status || "재직"}</span>
                </td>
                <td>{emp.joinDate}</td>
                <td>{emp.serviceText}</td>
                <td>{emp.baseLeave}일</td>
                <td>{emp.adjustmentDays}일</td>
                <td>
                  {Number(emp.vacationDeductionDays || 0) > 0
                    ? `-${emp.vacationDeductionDays}일`
                    : "0일"}
                </td>
                <td>{emp.usedLeave}일</td>
                <td className="strong-blue">{emp.remainingLeave}일</td>
                {showActions && (
                  <td>
                    {adminMode ? (
                      <div className="action-buttons">
                        <button className="small-btn" onClick={() => startEditEmployee(emp)}>
                          수정
                        </button>
                        <button
                          className="danger-small"
                          onClick={() => handleDeleteEmployee(emp.employeeId)}
                        >
                          삭제
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function CalendarPanel({
  selectedYear,
  selectedMonth,
  setSelectedMonth,
  employees,
  monthLeaveUses,
  monthHolidayWorks,
  monthVacationDeductions,
  monthPublicHolidays,
}) {
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const firstDayIndex = getFirstDayIndex(selectedYear, selectedMonth);
  const cells = [];

  for (let i = 0; i < firstDayIndex; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  function prevMonth() {
    setSelectedMonth((prev) => (prev === 1 ? 12 : prev - 1));
  }

  function nextMonth() {
    setSelectedMonth((prev) => (prev === 12 ? 1 : prev + 1));
  }

  function dateKey(day) {
    return `${selectedYear}-${pad2(selectedMonth)}-${pad2(day)}`;
  }

  function isAllEmployeeHolidayWork(items) {
    const employeeCount = employees.length;
    const workedEmployeeIds = new Set(
      items.map((row) => String(row["직원ID"] || "")).filter(Boolean)
    );

    return employeeCount > 0 && workedEmployeeIds.size >= employeeCount;
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <h2>
            {selectedYear}년 {selectedMonth}월 달력
          </h2>
          <p className="section-desc">대한민국 공휴일과 날짜별 연차 사용자를 한눈에 확인</p>
        </div>

        <div className="calendar-actions">
          <button className="small-btn" onClick={() => setSelectedMonth(todayMonth())}>
            오늘
          </button>
          <button className="small-btn" onClick={prevMonth}>
            <ChevronLeft size={16} />
          </button>
          <button className="small-btn" onClick={nextMonth}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="calendar-week">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((day, index) => {
          const currentDate = day ? dateKey(day) : "";

          const publicHolidayItems = monthPublicHolidays.filter(
            (row) => formatDate(row.date) === currentDate
          );

          const leaveItems = monthLeaveUses.filter(
            (row) => formatDate(row["사용일자"]) === currentDate
          );

          const holidayItems = monthHolidayWorks.filter(
            (row) => formatDate(row["근무일자"]) === currentDate
          );

          const vacationItems = monthVacationDeductions.filter((row) =>
            isDateBetween(currentDate, row["시작일"], row["종료일"])
          );

          const allEmployeeHolidayWork = isAllEmployeeHolidayWork(holidayItems);

          return (
            <div className="calendar-cell" key={index}>
              {day && (
                <>
                  <div
                    className={`date-number ${
                      index % 7 === 0 ? "sun" : index % 7 === 6 ? "sat" : ""
                    }`}
                  >
                    {day}
                  </div>

                  {publicHolidayItems.map((row) => (
                    <div className="calendar-pill holiday-red" key={`${row.date}-${row.title}`}>
                      {row.title}
                    </div>
                  ))}

                  {leaveItems.map((row) => (
                    <div className="calendar-pill blue" key={row["사용ID"]}>
                      {row["직원명"]} 연차
                    </div>
                  ))}

                  {allEmployeeHolidayWork ? (
                    <div className="calendar-pill orange" key={`${currentDate}-all-holiday-work`}>
                      전체직원 +1
                    </div>
                  ) : (
                    holidayItems.map((row) => (
                      <div className="calendar-pill orange" key={row["근무ID"]}>
                        {row["직원명"]} +1
                      </div>
                    ))
                  )}

                  {vacationItems.map((row) => (
                    <div className="calendar-pill red" key={row["차감ID"]}>
                      휴가 차감
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="legend">
        <span>
          <i className="dot holiday-red"></i> 대한민국 공휴일
        </span>
        <span>
          <i className="dot blue"></i> 연차 사용
        </span>
        <span>
          <i className="dot orange"></i> 공휴일 근무 +1일
        </span>
        <span>
          <i className="dot red"></i> 휴가 차감
        </span>
      </div>
    </>
  );
}

function EmployeesView({
  employees,
  adminMode,
  employeeForm,
  setEmployeeForm,
  handleSaveEmployee,
  startEditEmployee,
  handleDeleteEmployee,
  editingEmployeeId,
  cancelEdit,
}) {
  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>직원 현황</h2>
          <p className="section-desc">
            직원 입사일을 기준으로 연도별 기본 연차가 자동 계산됩니다.
          </p>
        </div>
        <span className="premium-badge">EMPLOYEE</span>
      </div>

      {adminMode ? (
        <form className="form-grid" onSubmit={handleSaveEmployee}>
          <input
            placeholder="직원명"
            value={employeeForm.employeeName}
            onChange={(e) => setEmployeeForm({ ...employeeForm, employeeName: e.target.value })}
          />
          <input
            type="date"
            value={employeeForm.joinDate}
            onChange={(e) => setEmployeeForm({ ...employeeForm, joinDate: e.target.value })}
          />
          <select
            value={employeeForm.status}
            onChange={(e) => setEmployeeForm({ ...employeeForm, status: e.target.value })}
          >
            <option value="재직">재직</option>
            <option value="퇴사">퇴사</option>
          </select>
          <input
            placeholder="메모"
            value={employeeForm.memo}
            onChange={(e) => setEmployeeForm({ ...employeeForm, memo: e.target.value })}
          />
          <button className="primary-btn">{editingEmployeeId ? "직원 수정" : "직원 추가"}</button>
          {editingEmployeeId && (
            <button type="button" className="small-btn" onClick={cancelEdit}>
              취소
            </button>
          )}
        </form>
      ) : (
        <p className="panel-note">※ 직원 추가/수정/삭제는 설정 메뉴에서 관리자 로그인 후 가능합니다.</p>
      )}

      <EmployeeTable
        employees={employees}
        showActions={true}
        adminMode={adminMode}
        startEditEmployee={startEditEmployee}
        handleDeleteEmployee={handleDeleteEmployee}
      />
    </section>
  );
}

function LeaveUseView({
  employees,
  leaveUses,
  adminMode,
  leaveForm,
  setLeaveForm,
  handleSaveLeaveUse,
  startEditLeaveUse,
  handleDeleteLeave,
  editingUseId,
  cancelEdit,
}) {
  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>연차 사용 관리</h2>
          <p className="section-desc">반차 없이 1일 단위로 연차 사용 내역을 등록합니다.</p>
        </div>
        <span className="premium-badge">1 DAY</span>
      </div>

      {adminMode ? (
        <form className="form-grid" onSubmit={handleSaveLeaveUse}>
          <select
            value={leaveForm.employeeId}
            onChange={(e) => setLeaveForm({ ...leaveForm, employeeId: e.target.value })}
          >
            <option value="">직원 선택</option>
            {employees.map((emp) => (
              <option key={emp.employeeId} value={emp.employeeId}>
                {emp.employeeName}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={leaveForm.useDate}
            onChange={(e) => setLeaveForm({ ...leaveForm, useDate: e.target.value })}
          />

          <input value="1일" readOnly className="readonly-input" />

          <input
            placeholder="사유"
            value={leaveForm.reason}
            onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
          />

          <button className="primary-btn">{editingUseId ? "연차 수정" : "연차 등록"}</button>
          {editingUseId && (
            <button type="button" className="small-btn" onClick={cancelEdit}>
              취소
            </button>
          )}
        </form>
      ) : (
        <p className="panel-note">※ 관리자 모드에서만 연차 사용 등록/수정/삭제가 가능합니다.</p>
      )}

      <ActionTable
        headers={["날짜", "직원명", "사용일수", "사유", "관리"]}
        rows={leaveUses.map((row) => [
          row["사용일자"],
          row["직원명"],
          `${row["사용일수"]}일`,
          row["사유"],
          adminMode ? (
            <div className="action-buttons">
              <button className="small-btn" onClick={() => startEditLeaveUse(row)}>
                수정
              </button>
              <button className="danger-small" onClick={() => handleDeleteLeave(row["사용ID"])}>
                삭제
              </button>
            </div>
          ) : (
            "-"
          ),
        ])}
      />
    </section>
  );
}

function HolidayWorkView({
  employees,
  holidayWorks,
  adminMode,
  holidayForm,
  setHolidayForm,
  handleSaveHolidayWork,
  startEditHolidayWork,
  handleDeleteHoliday,
  editingWorkId,
  cancelEdit,
}) {
  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>공휴일 근무 관리</h2>
          <p className="section-desc">
            법정공휴일 근무 시 전체 직원 또는 개별 직원에게 연차 +1일을 적립합니다.
          </p>
        </div>
        <span className="premium-badge">+1 DAY</span>
      </div>

      {adminMode ? (
        <form className="form-grid" onSubmit={handleSaveHolidayWork}>
          <select
            value={holidayForm.targetType}
            disabled={!!editingWorkId}
            onChange={(e) =>
              setHolidayForm({
                ...holidayForm,
                targetType: e.target.value,
                employeeId: "",
              })
            }
          >
            <option value="개별">개별 직원</option>
            <option value="전체">전체 직원</option>
          </select>

          {holidayForm.targetType === "개별" ? (
            <select
              value={holidayForm.employeeId}
              onChange={(e) => setHolidayForm({ ...holidayForm, employeeId: e.target.value })}
            >
              <option value="">직원 선택</option>
              {employees.map((emp) => (
                <option key={emp.employeeId} value={emp.employeeId}>
                  {emp.employeeName}
                </option>
              ))}
            </select>
          ) : (
            <input value={`재직 직원 전체 ${employees.length}명`} readOnly className="readonly-input" />
          )}

          <input
            type="date"
            value={holidayForm.workDate}
            onChange={(e) => setHolidayForm({ ...holidayForm, workDate: e.target.value })}
          />

          <input
            placeholder="공휴일명 예: 어린이날"
            value={holidayForm.holidayName}
            onChange={(e) => setHolidayForm({ ...holidayForm, holidayName: e.target.value })}
          />

          <input value="+1일 자동 적립" readOnly className="readonly-input" />

          <button className="primary-btn">
            {editingWorkId ? "공휴일 근무 수정" : "공휴일 근무 등록"}
          </button>
          {editingWorkId && (
            <button type="button" className="small-btn" onClick={cancelEdit}>
              취소
            </button>
          )}
        </form>
      ) : (
        <p className="panel-note">※ 관리자 모드에서만 공휴일 근무 등록/수정/삭제가 가능합니다.</p>
      )}

      <ActionTable
        headers={["근무일자", "직원명", "공휴일명", "적립일수", "관리"]}
        rows={holidayWorks.map((row) => [
          row["근무일자"],
          row["직원명"],
          row["공휴일명"],
          `+${row["적립일수"]}일`,
          adminMode ? (
            <div className="action-buttons">
              <button className="small-btn" onClick={() => startEditHolidayWork(row)}>
                수정
              </button>
              <button className="danger-small" onClick={() => handleDeleteHoliday(row["근무ID"])}>
                삭제
              </button>
            </div>
          ) : (
            "-"
          ),
        ])}
      />
    </section>
  );
}

function VacationDeductionView({
  employees,
  vacationDeductions,
  adminMode,
  vacationForm,
  setVacationForm,
  handleSaveVacationDeduction,
  startEditVacationDeduction,
  handleDeleteVacation,
  editingDeductionId,
  cancelEdit,
}) {
  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>휴가 차감 관리</h2>
          <p className="section-desc">
            회사 휴가 기간을 전체 직원 또는 개별 직원에게 원하는 일수만큼 차감 적용합니다.
          </p>
        </div>
        <span className="premium-badge">DEDUCTION</span>
      </div>

      {adminMode ? (
        <form className="form-grid" onSubmit={handleSaveVacationDeduction}>
          <input
            type="date"
            value={vacationForm.startDate}
            onChange={(e) => setVacationForm({ ...vacationForm, startDate: e.target.value })}
          />

          <input
            type="date"
            value={vacationForm.endDate}
            onChange={(e) => setVacationForm({ ...vacationForm, endDate: e.target.value })}
          />

          <input
            type="number"
            min="1"
            step="1"
            placeholder="차감 일수 입력"
            value={vacationForm.deductionDays}
            onChange={(e) =>
              setVacationForm({ ...vacationForm, deductionDays: e.target.value })
            }
          />

          <select
            value={vacationForm.targetType}
            onChange={(e) =>
              setVacationForm({
                ...vacationForm,
                targetType: e.target.value,
                employeeId: "",
              })
            }
          >
            <option value="전체">전체 직원</option>
            <option value="개별">개별 직원</option>
          </select>

          {vacationForm.targetType === "개별" && (
            <select
              value={vacationForm.employeeId}
              onChange={(e) =>
                setVacationForm({ ...vacationForm, employeeId: e.target.value })
              }
            >
              <option value="">직원 선택</option>
              {employees.map((emp) => (
                <option key={emp.employeeId} value={emp.employeeId}>
                  {emp.employeeName}
                </option>
              ))}
            </select>
          )}

          <button className="primary-btn">
            {editingDeductionId ? "휴가 차감 수정" : "휴가 차감 등록"}
          </button>
          {editingDeductionId && (
            <button type="button" className="small-btn" onClick={cancelEdit}>
              취소
            </button>
          )}
        </form>
      ) : (
        <p className="panel-note">※ 관리자 모드에서만 휴가 차감 등록/수정/삭제가 가능합니다.</p>
      )}

      <ActionTable
        headers={["기간", "차감일수", "적용대상", "직원명", "관리"]}
        rows={vacationDeductions.map((row) => [
          `${row["시작일"]} ~ ${row["종료일"]}`,
          `-${row["차감일수"]}일`,
          row["적용대상"],
          row["직원명"] || "전체",
          adminMode ? (
            <div className="action-buttons">
              <button className="small-btn" onClick={() => startEditVacationDeduction(row)}>
                수정
              </button>
              <button
                className="danger-small"
                onClick={() => handleDeleteVacation(row["차감ID"])}
              >
                삭제
              </button>
            </div>
          ) : (
            "-"
          ),
        ])}
      />
    </section>
  );
}

function AdjustView({
  employees,
  adjustments,
  adminMode,
  adjustmentForm,
  setAdjustmentForm,
  handleSaveAdjustment,
  startEditAdjustment,
  handleDeleteAdjustment,
  editingAdjustmentId,
  cancelEdit,
}) {
  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>연차 조정 관리</h2>
          <p className="section-desc">
            공휴일 근무 자동 적립과 별도 수동 조정 내역을 관리합니다.
          </p>
        </div>
        <span className="premium-badge">ADJUST</span>
      </div>

      {adminMode ? (
        <form className="form-grid" onSubmit={handleSaveAdjustment}>
          <select
            value={adjustmentForm.employeeId}
            onChange={(e) =>
              setAdjustmentForm({ ...adjustmentForm, employeeId: e.target.value })
            }
          >
            <option value="">직원 선택</option>
            {employees.map((emp) => (
              <option key={emp.employeeId} value={emp.employeeId}>
                {emp.employeeName}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={adjustmentForm.applyDate}
            onChange={(e) =>
              setAdjustmentForm({ ...adjustmentForm, applyDate: e.target.value })
            }
          />

          <select
            value={adjustmentForm.adjustmentType}
            onChange={(e) =>
              setAdjustmentForm({ ...adjustmentForm, adjustmentType: e.target.value })
            }
          >
            <option value="수동조정">수동조정</option>
            <option value="특별휴가">특별휴가</option>
            <option value="이월연차">이월연차</option>
            <option value="오입력보정">오입력보정</option>
          </select>

          <select
            value={adjustmentForm.adjustmentDays}
            onChange={(e) =>
              setAdjustmentForm({ ...adjustmentForm, adjustmentDays: e.target.value })
            }
          >
            <option value="1">+1일</option>
            <option value="2">+2일</option>
            <option value="3">+3일</option>
            <option value="-1">-1일</option>
            <option value="-2">-2일</option>
            <option value="-3">-3일</option>
          </select>

          <input
            placeholder="내용"
            value={adjustmentForm.content}
            onChange={(e) =>
              setAdjustmentForm({ ...adjustmentForm, content: e.target.value })
            }
          />

          <button className="primary-btn">
            {editingAdjustmentId ? "조정 수정" : "조정 등록"}
          </button>
          {editingAdjustmentId && (
            <button type="button" className="small-btn" onClick={cancelEdit}>
              취소
            </button>
          )}
        </form>
      ) : (
        <p className="panel-note">※ 관리자 모드에서만 연차 조정 등록/수정/삭제가 가능합니다.</p>
      )}

      <ActionTable
        headers={["적용일자", "직원명", "조정구분", "조정일수", "내용", "관리"]}
        rows={adjustments.map((row) => [
          row["적용일자"],
          row["직원명"],
          row["조정구분"],
          `${Number(row["조정일수"]) > 0 ? "+" : ""}${row["조정일수"]}일`,
          row["내용"],
          adminMode ? (
            <div className="action-buttons">
              <button
                className="small-btn"
                onClick={() => startEditAdjustment(row)}
                disabled={row["조정구분"] === "공휴일근무"}
              >
                수정
              </button>
              <button
                className="danger-small"
                onClick={() => handleDeleteAdjustment(row["조정ID"], row["조정구분"])}
              >
                삭제
              </button>
            </div>
          ) : (
            "-"
          ),
        ])}
      />
    </section>
  );
}

function CalendarOnlyView(props) {
  return (
    <section className="panel full">
      <CalendarPanel {...props} />
    </section>
  );
}

function SettingsView({
  adminMode,
  adminPassword,
  setAdminPassword,
  handleAdminLogin,
  setAdminMode,
}) {
  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>설정</h2>
          <p className="section-desc">
            관리자 모드 전환 후 직원/연차/공휴일/휴가차감 데이터를 등록할 수 있습니다.
          </p>
        </div>
        <span className="premium-badge">ADMIN</span>
      </div>

      {!adminMode ? (
        <div className="login-box">
          <h3>관리자 로그인</h3>
          <p>
            관리자 모드에서 직원 추가, 연차 등록, 공휴일 근무 등록, 휴가 차감
            등록, 연차 조정 등록이 가능합니다.
          </p>
          <input
            type="password"
            placeholder="관리자 비밀번호"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          <button className="primary-btn" onClick={handleAdminLogin}>
            관리자 로그인
          </button>
        </div>
      ) : (
        <div className="login-box">
          <h3>현재 관리자 모드입니다.</h3>
          <p>등록/수정/삭제 기능을 사용할 수 있습니다.</p>
          <button className="danger-btn" onClick={() => setAdminMode(false)}>
            관리자 모드 종료
          </button>
        </div>
      )}
    </section>
  );
}

function SimpleTable({ headers, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="empty-cell">
                등록된 데이터가 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ActionTable({ headers, rows }) {
  return <SimpleTable headers={headers} rows={rows} />;
}

export default App;

import { useEffect, useMemo, useState } from "react";
import { formatVND, labelBookingStatus, labelPaymentStatus, pick } from "../../api";
import { dashboardApi } from "../../services/dashboardApi";
import StatusBadge from "./components/StatusBadge";

function toDateInput(value) {
  return value.toISOString().slice(0, 10);
}

function buildRange(period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === "today") {
    return { fromDate: toDateInput(today), toDate: toDateInput(today) };
  }

  if (period === "month") {
    return {
      fromDate: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
      toDate: toDateInput(today),
    };
  }

  if (period === "year") {
    return {
      fromDate: toDateInput(new Date(now.getFullYear(), 0, 1)),
      toDate: toDateInput(today),
    };
  }

  const from = new Date(today);
  from.setDate(from.getDate() - 6);
  return { fromDate: toDateInput(from), toDate: toDateInput(today) };
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString("vi-VN") : "";
}

function getPaymentStatus(item) {
  return pick(item, ["paymentStatus", "PaymentStatus", "status", "Status"], "Pending");
}

function getMax(items, key) {
  return Math.max(1, ...items.map((item) => Number(pick(item, [key, key[0].toUpperCase() + key.slice(1)], 0))));
}

function MiniBarChart({ items, valueKey = "revenue", labelFor, valueFor }) {
  if (!items.length) {
    return <div className="dashboard-empty">Chưa có dữ liệu trong khoảng thời gian này.</div>;
  }

  const max = getMax(items, valueKey);

  return (
    <div className="dashboard-bars">
      {items.map((item, index) => {
        const value = Number(pick(item, [valueKey, valueKey[0].toUpperCase() + valueKey.slice(1)], 0));
        const height = Math.max(16, Math.round((value / max) * 150));
        return (
          <div className="dashboard-bar-item" key={`${labelFor(item)}-${index}`}>
            <span>{valueFor ? valueFor(item) : formatVND(value)}</span>
            <div className="dashboard-bar-track">
              <div className="dashboard-bar" style={{ height }} />
            </div>
            <small>{labelFor(item)}</small>
          </div>
        );
      })}
    </div>
  );
}

function RankTable({ title, items, nameFor }) {
  return (
    <div className="admin-card dashboard-rank-card">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Doanh thu</th>
              <th>Booking</th>
              <th>Vé</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${nameFor(item)}-${index}`}>
                <td><b>{nameFor(item)}</b></td>
                <td>{formatVND(pick(item, ["revenue", "Revenue"], 0))}</td>
                <td>{pick(item, ["bookingCount", "BookingCount"], 0)}</td>
                <td>{pick(item, ["ticketCount", "TicketCount"], 0)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan="4" className="empty-cell">Chưa có dữ liệu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardTripsTable({ trips }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Tuyến</th>
            <th>Giờ đi</th>
            <th>Nhà xe</th>
            <th>Loại xe</th>
            <th>Chỗ</th>
            <th>Giá</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => {
            const id = pick(trip, ["tripID", "TripID", "id"]);
            return (
              <tr key={id}>
                <td>{id}</td>
                <td>
                  <b>{trip.departureLocation}</b>
                  {" -> "}
                  <b>{trip.arrivalLocation}</b>
                </td>
                <td>{formatDateTime(trip.departureTime)}</td>
                <td>{trip.operator || "Chưa rõ"}</td>
                <td>{trip.busType || "Chưa rõ"}</td>
                <td>{trip.availableSeats}</td>
                <td>{formatVND(trip.price)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminDashboard({
  stats,
  trips,
  upcomingTrips,
  bookings,
  buses = [],
  operators = [],
  users = [],
}) {
  const [period, setPeriod] = useState("7days");
  const [dashboard, setDashboard] = useState({
    summary: null,
    revenueByDay: [],
    revenueByMonth: [],
    topRoutes: [],
    topOperators: [],
    statusStats: { paymentStatuses: [], bookingStatuses: [] },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const range = useMemo(() => buildRange(period), [period]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = { ...range };
        const [summary, revenueByDay, revenueByMonth, topRoutes, topOperators, statusStats] = await Promise.all([
          dashboardApi.adminSummary(params),
          dashboardApi.revenueByDay(params),
          dashboardApi.revenueByMonth(params),
          dashboardApi.topRoutes({ ...params, take: 5 }),
          dashboardApi.topOperators({ ...params, take: 5 }),
          dashboardApi.bookingStatusStatistics(params),
        ]);

        if (!alive) return;
        setDashboard({
          summary,
          revenueByDay: Array.isArray(revenueByDay) ? revenueByDay : [],
          revenueByMonth: Array.isArray(revenueByMonth) ? revenueByMonth : [],
          topRoutes: Array.isArray(topRoutes) ? topRoutes : [],
          topOperators: Array.isArray(topOperators) ? topOperators : [],
          statusStats: statusStats || { paymentStatuses: [], bookingStatuses: [] },
        });
      } catch (err) {
        if (alive) setError(err.message || "Không tải được thống kê dashboard.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [range.fromDate, range.toDate]);

  const summary = dashboard.summary || stats || {};
  const cards = [
    ["Tổng doanh thu", formatVND(pick(summary, ["totalRevenue", "TotalRevenue", "revenue", "Revenue"], 0)), "fa-money-bill-wave", "#ea580c"],
    ["Doanh thu hôm nay", formatVND(pick(summary, ["todayRevenue", "TodayRevenue"], 0)), "fa-calendar-day", "#16a34a"],
    ["Doanh thu tháng này", formatVND(pick(summary, ["monthRevenue", "MonthRevenue"], 0)), "fa-calendar-check", "#0ea5e9"],
    ["Booking", pick(summary, ["totalBookings", "TotalBookings"], bookings.length), "fa-file-invoice", "#2563eb"],
    ["Vé đã bán", pick(summary, ["totalTicketsSold", "TotalTicketsSold"], 0), "fa-ticket", "#7c3aed"],
    ["Chuyến xe", pick(summary, ["totalTrips", "TotalTrips"], trips.length), "fa-route", "#db2777"],
    ["Người dùng", pick(summary, ["totalUsers", "TotalUsers"], users.length), "fa-users", "#0891b2"],
    ["Nhà xe", pick(summary, ["totalOperators", "TotalOperators"], operators.length), "fa-building", "#475569"],
    ["Xe", pick(summary, ["totalBuses", "TotalBuses"], buses.length), "fa-bus", "#65a30d"],
    ["Chờ thanh toán", pick(summary, ["pendingPaymentCount", "PendingPaymentCount"], 0), "fa-clock", "#f59e0b"],
    ["Đã thanh toán", pick(summary, ["paidCount", "PaidCount"], 0), "fa-circle-check", "#16a34a"],
    ["Chờ duyệt hủy", pick(summary, ["cancelRequestedCount", "CancelRequestedCount"], 0), "fa-rotate-left", "#dc2626"],
  ];

  const bookingStatuses = dashboard.statusStats?.bookingStatuses || dashboard.statusStats?.BookingStatuses || [];
  const paymentStatuses = dashboard.statusStats?.paymentStatuses || dashboard.statusStats?.PaymentStatuses || [];

  return (
    <>
      <div className="dashboard-toolbar">
        <div>
          <h2>Dashboard vận hành</h2>
          <p>
            Doanh thu chỉ tính đơn <b>đã thanh toán</b> và <b>đã xác nhận</b>; đơn hủy/hoàn tiền không được tính.
          </p>
        </div>
        <div className="dashboard-periods">
          {[
            ["today", "Hôm nay"],
            ["7days", "7 ngày"],
            ["month", "Tháng này"],
            ["year", "Năm nay"],
          ].map(([value, label]) => (
            <button
              type="button"
              className={period === value ? "active" : ""}
              onClick={() => setPeriod(value)}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {loading && <div className="admin-loading">Đang tải thống kê...</div>}

      <section className="admin-stats dashboard-stats">
        {cards.map(([label, value, icon, color]) => (
          <div className="stat-card" key={label} style={{ borderLeft: `4px solid ${color}` }}>
            <div>
              <p>{label}</p>
              <h2>{value}</h2>
            </div>
            <i className={`fa-solid ${icon}`} style={{ color }} />
          </div>
        ))}
      </section>

      <section className="dashboard-chart-grid">
        <div className="admin-card">
          <h3>Doanh thu theo ngày</h3>
          <MiniBarChart
            items={dashboard.revenueByDay}
            labelFor={(item) => formatDate(pick(item, ["date", "Date"]))}
          />
        </div>
        <div className="admin-card">
          <h3>Doanh thu theo tháng</h3>
          <MiniBarChart
            items={dashboard.revenueByMonth}
            labelFor={(item) => `${pick(item, ["month", "Month"])}/${pick(item, ["year", "Year"])}`}
          />
        </div>
      </section>

      <section className="dashboard-chart-grid">
        <RankTable
          title="Top tuyến bán chạy"
          items={dashboard.topRoutes}
          nameFor={(item) => pick(item, ["route", "Route"], "Chưa rõ tuyến")}
        />
        <RankTable
          title="Top nhà xe doanh thu cao"
          items={dashboard.topOperators}
          nameFor={(item) => pick(item, ["operatorName", "OperatorName"], "Chưa rõ nhà xe")}
        />
      </section>

      <section className="dashboard-chart-grid">
        <div className="admin-card">
          <h3>Trạng thái booking</h3>
          <div className="dashboard-status-list">
            {bookingStatuses.map((item) => (
              <div key={pick(item, ["status", "Status"])}>
                <StatusBadge>{labelBookingStatus(pick(item, ["status", "Status"]))}</StatusBadge>
                <strong>{pick(item, ["count", "Count"], 0)}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="admin-card">
          <h3>Trạng thái thanh toán</h3>
          <div className="dashboard-status-list">
            {paymentStatuses.map((item) => (
              <div key={pick(item, ["status", "Status"])}>
                <StatusBadge>{labelPaymentStatus(pick(item, ["status", "Status"]))}</StatusBadge>
                <strong>{pick(item, ["count", "Count"], 0)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-grid">
        <div className="admin-card">
          <h3>Chuyến sắp chạy</h3>
          <DashboardTripsTable trips={upcomingTrips.slice(0, 5)} />
        </div>
        <div className="admin-card">
          <h3>Đơn đặt vé mới nhất</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Khách</th>
                  <th>Tuyến</th>
                  <th>Thanh toán</th>
                  <th>Tiền</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 6).map((booking) => {
                  const id = pick(booking, ["bookingID", "BookingID"]);
                  return (
                    <tr key={id}>
                      <td>{id}</td>
                      <td>{pick(booking, ["customerName", "CustomerName"])}</td>
                      <td>{pick(booking, ["route", "Route"]) || "..."}</td>
                      <td>
                        <StatusBadge>{labelPaymentStatus(getPaymentStatus(booking))}</StatusBadge>
                      </td>
                      <td>{formatVND(pick(booking, ["totalPrice", "TotalPrice"], 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

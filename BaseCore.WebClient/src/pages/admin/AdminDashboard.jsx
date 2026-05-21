import { formatVND, labelPaymentStatus, pick } from "../../api";
import StatusBadge from "./components/StatusBadge";

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString("vi-VN") : "";
}

function getPaymentStatus(item) {
  return pick(
    item,
    ["paymentStatus", "PaymentStatus", "status", "Status"],
    "Pending",
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
                <td>{trip.id}</td>
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
  revenueStats,
  buses = [],
  operators = [],
  users = [],
}) {
  const cards = [
    [
      "Tổng số vé",
      pick(
        stats,
        ["totalTickets", "TotalTickets"],
        bookings.reduce(
          (sum, item) =>
            sum + Number(pick(item, ["totalSeats", "TotalSeats"], 0)),
          0,
        ),
      ),
      "fa-ticket",
      "#16a34a",
    ],
    [
      "Tổng số xe",
      pick(stats, ["totalBuses", "TotalBuses"], buses.length),
      "fa-bus",
      "#2563eb",
    ],
    [
      "Tổng nhà xe",
      pick(stats, ["totalOperators", "TotalOperators"], operators.length),
      "fa-building",
      "#0ea5e9",
    ],
    [
      "Tổng doanh thu",
      formatVND(
        pick(stats, ["totalRevenue", "TotalRevenue", "revenue", "Revenue"], 0),
      ),
      "fa-money-bill-wave",
      "#ea580c",
    ],
    [
      "Tổng chuyến xe",
      pick(stats, ["totalTrips", "TotalTrips"], trips.length),
      "fa-route",
      "#7c3aed",
    ],
    [
      "Tổng người dùng",
      pick(stats, ["totalUsers", "TotalUsers"], users.length),
      "fa-users",
      "#db2777",
    ],
  ];

  const last6 = revenueStats.slice(-6);

  return (
    <>
      <section className="admin-stats">
        {cards.map(([label, value, icon, color]) => (
          <div
            className="stat-card"
            key={label}
            style={{ borderLeft: `4px solid ${color}` }}
          >
            <div>
              <p>{label}</p>
              <h2>{value}</h2>
            </div>
            <i className={`fa-solid ${icon}`} style={{ color }} />
          </div>
        ))}
      </section>

      {last6.length > 0 && (
        <div className="admin-card" style={{ marginBottom: 24 }}>
          <h3>Doanh thu theo tháng (đã thanh toán)</h3>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              height: 200,
              padding: "16px 0",
            }}
          >
            {last6.map((item) => {
              const maxRevenue = Math.max(
                ...last6.map((x) => Number(x.revenue || x.Revenue)),
              );
              const revenue = Number(item.revenue || item.Revenue);
              const height =
                maxRevenue > 0
                  ? Math.max(20, (revenue / maxRevenue) * 160)
                  : 20;
              return (
                <div
                  key={`${item.year || item.Year}-${item.month || item.Month}`}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <small style={{ fontSize: 10, color: "#666" }}>
                    {formatVND(revenue)}
                  </small>
                  <div
                    style={{
                      width: "100%",
                      height,
                      background: "#2563eb",
                      borderRadius: "4px 4px 0 0",
                    }}
                  />
                  <small style={{ fontSize: 11 }}>
                    {item.month || item.Month}/{item.year || item.Year}
                  </small>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                  <th>Trạng thái</th>
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
                        <StatusBadge>
                          {labelPaymentStatus(getPaymentStatus(booking))}
                        </StatusBadge>
                      </td>
                      <td>
                        {formatVND(
                          pick(booking, ["totalPrice", "TotalPrice"], 0),
                        )}
                      </td>
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

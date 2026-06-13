import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../layouts/UserLayout";
import { API_BASE } from "../api";
import { promotionApi } from "../services/promotionApi";

const offerItems = [
  {
    title: "Giảm 20% tuyến đêm",
    desc: "Áp dụng cho các chuyến khởi hành sau 20:00 trong tuần.",
    icon: "fa-moon",
  },
  {
    title: "Hoàn xu khách mới",
    desc: "Tặng điểm thưởng cho đơn đặt vé đầu tiên trên VéXeAZ.",
    icon: "fa-gift",
  },
  {
    title: "Combo khứ hồi",
    desc: "Đặt vé đi và về cùng lúc để nhận giá tốt hơn.",
    icon: "fa-repeat",
  },
];

const popularRoutes = [
  {
    route: "Hà Nội - Đà Nẵng",
    price: "Từ 250.000đ",
    image:
      "https://vcdn1-dulich.vnecdn.net/2022/06/03/cauvang-1654247842-9403-1654247849.jpg?w=1200&h=0&q=100&dpr=1&fit=crop&s=Swd6JjpStebEzT6WARcoOA",
  },
  {
    route: "Sài Gòn - Nha Trang",
    price: "Từ 300.000đ",
    image:
      "data:image/jpeg;base64,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",
  },
  {
    route: "Hà Nội - Sa Pa",
    price: "Từ 350.000đ",
    image:
      "https://booking.muongthanh.com/upload_images/images/H%60/sa-pa-thi-tran-trong-suong.jpg",
  },
  {
    route: "Sài Gòn - Đà Lạt",
    price: "Từ 220.000đ",
    image:
      "https://kenh14cdn.com/2016/12662627-1265391450144557-7741251277725824130-n-1-1454160360419.jpg",
  },
  {
    route: "Hà Nội - Hạ Long",
    price: "Từ 180.000đ",
    image:
      "https://cdn-media.sforum.vn/storage/app/media/anh-vinh-ha-long-28.jpg",
  },
  {
    route: "Đà Nẵng - Huế",
    price: "Từ 150.000đ",
    image:
      "https://static-images.vnncdn.net/files/publish/2022/8/24/emag-cover-desk-240.jpg?width=0&s=G6YvaRqM9_6S67asebgCXQ",
  },
];

const reasons = [
  [
    "fa-ticket",
    "Đặt vé nhanh",
    "Tìm chuyến, giữ ghế và thanh toán trong một luồng rõ ràng.",
  ],
  [
    "fa-shield-halved",
    "Thông tin minh bạch",
    "Giá vé, giờ chạy và trạng thái ghế được hiển thị trực tiếp.",
  ],
  [
    "fa-headset",
    "Hỗ trợ 24/7",
    "Đội ngũ hỗ trợ luôn sẵn sàng khi bạn cần thay đổi lịch trình.",
  ],
];

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDateLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getPromotionValue(item, keys, fallback = "") {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) return item[key];
  }
  return fallback;
}

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPromotionDate(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getPromotionTitle(item) {
  const type = Number(
    getPromotionValue(item, ["discountType", "DiscountType"], 1),
  );
  const value = Number(
    getPromotionValue(item, ["discountValue", "DiscountValue"], 0),
  );
  const maxDiscount = Number(
    getPromotionValue(item, ["maxDiscount", "MaxDiscount"], 0),
  );

  if (type === 1) {
    return `Giảm ${value}%${maxDiscount > 0 ? ` tối đa ${formatMoney(maxDiscount)}` : ""}`;
  }

  return `Giảm ${formatMoney(value)}`;
}

function getPromotionRules(item) {
  const minOrder = Number(
    getPromotionValue(item, ["minOrderValue", "MinOrderValue"], 0),
  );
  const remainingUses = getPromotionValue(
    item,
    ["remainingUses", "RemainingUses"],
    null,
  );
  const endDate = getPromotionValue(item, ["endDate", "EndDate"]);
  const rules = [];

  if (minOrder > 0) rules.push(`Đơn tối thiểu ${formatMoney(minOrder)}`);
  rules.push(
    remainingUses === null
      ? "Không giới hạn lượt dùng"
      : `Còn ${remainingUses} lượt`,
  );
  rules.push(`Hạn dùng đến ${formatPromotionDate(endDate)}`);
  return rules;
}

function getPromotionDescription(item) {
  return (
    getPromotionValue(item, ["description", "Description"], "") ||
    "Áp dụng theo điều kiện của chương trình ưu đãi."
  );
}

function getVisibleItems(items, start, size = 3) {
  if (!items.length) return [];
  return Array.from(
    { length: Math.min(size, items.length) },
    (_, index) => items[(start + index) % items.length],
  );
}

// function LocationPicker({
//   label,
//   value,
//   onChange,
//   options,
//   icon,
//   accentClass,
//   placeholder,
// }) {
//   const [open, setOpen] = useState(false);
//   const [isTyping, setIsTyping] = useState(false);
//   const filteredOptions = useMemo(() => {
//     const keyword = isTyping ? normalizeText(value) : "";
//     const source = keyword
//       ? options.filter((item) => normalizeText(item).includes(keyword))
//       : options;
//     return source.slice(0, 12);
//   }, [isTyping, options, value]);

//   const selectLocation = (location) => {
//     onChange(location);
//     setIsTyping(false);
//     setOpen(false);
//   };

//   return (
//     <div className={`home-location-picker ${open ? "open" : ""}`}>
//       <i className={`fa-solid ${icon} ${accentClass}`} />
//       <label>
//         <span>{label}</span>
//         <input
//           value={value}
//           placeholder={placeholder}
//           onFocus={() => {
//             setIsTyping(false);
//             setOpen(true);
//           }}
//           onChange={(event) => {
//             onChange(event.target.value);
//             setIsTyping(true);
//             setOpen(true);
//           }}
//           onBlur={() =>
//             window.setTimeout(() => {
//               setIsTyping(false);
//               setOpen(false);
//             }, 120)
//           }
//         />
//       </label>

//       {open && (
//         <div className="home-location-menu">
//           <strong>Địa điểm phổ biến</strong>
//           {filteredOptions.length > 0 ? (
//             filteredOptions.map((location) => (
//               <button
//                 type="button"
//                 key={location}
//                 onMouseDown={(event) => event.preventDefault()}
//                 onClick={() => selectLocation(location)}
//               >
//                 <i className="fa-solid fa-location-dot" />
//                 <span>{location}</span>
//               </button>
//             ))
//           ) : (
//             <p>Không có gợi ý phù hợp. Bạn có thể nhập tay.</p>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }
function LocationPicker({
  label,
  value,
  onChange,
  options,
  icon,
  accentClass,
  placeholder,
}) {
  const [open, setOpen] = useState(false);

  const selectLocation = (location) => {
    onChange(location);
    setOpen(false);
  };

  const filteredOptions = useMemo(() => {
    return options.slice(0, 12);
  }, [options]);

  return (
    <div className={`home-location-picker ${open ? "open" : ""}`}>
      <i className={`fa-solid ${icon} ${accentClass}`} />
      <label>
        <span>{label}</span>
        <input
          value={value}
          placeholder={placeholder}
          readOnly // ← không cho gõ tay
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        />
      </label>

      {open && (
        <div className="home-location-menu">
          <strong>Địa điểm phổ biến</strong>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((location) => (
              <button
                type="button"
                key={location}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectLocation(location)}
              >
                <i className="fa-solid fa-location-dot" />
                <span>{location}</span>
              </button>
            ))
          ) : (
            <p>Không có gợi ý.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DatePickerField({ label, value, min, onChange, icon, emptyText }) {
  const inputRef = useRef(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.focus();
  };

  return (
    <button type="button" className="home-date-field" onClick={openPicker}>
      <i className={`fa-solid ${icon}`} />
      <span>{label}</span>
      <strong>{value ? formatDateLabel(value) : emptyText}</strong>
      <input
        ref={inputRef}
        type="date"
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
      />
    </button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const today = useMemo(() => getToday(), []);
  // const [locations, setLocations] = useState([]);
  const [departureOptions, setDepartureOptions] = useState([]);
  const [arrivalOptions, setArrivalOptions] = useState([]);
  const [publicPromotions, setPublicPromotions] = useState([]);
  const [routeIndex, setRouteIndex] = useState(0);
  const [promotionIndex, setPromotionIndex] = useState(0);
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    from: "",
    to: "",
    departureDate: today,
    isRoundTrip: false,
    returnDate: "",
  });

  // const locationOptions = useMemo(() => {
  //   return Array.from(
  //     new Set(
  //       locations.map((item) => String(item || "").trim()).filter(Boolean),
  //     ),
  //   ).sort((a, b) => a.localeCompare(b, "vi"));
  // }, [locations]);
  const visibleRoutes = useMemo(
    () => getVisibleItems(popularRoutes, routeIndex),
    [routeIndex],
  );
  const visiblePromotions = useMemo(
    () => getVisibleItems(publicPromotions, promotionIndex),
    [publicPromotions, promotionIndex],
  );

  // useEffect(() => {
  //   fetch(`${API_BASE}/api/trips/locations`)
  //     .then((response) => (response.ok ? response.json() : []))
  //     .then((data) => setLocations(Array.isArray(data) ? data : []))
  //     .catch(() => setLocations([]));
  // }, []);
  useEffect(() => {
    fetch(`${API_BASE}/api/trips/locations`)
      .then((response) => response.json())
      .then((data) => {
        setDepartureOptions(data.departures || []);
        setArrivalOptions(data.arrivals || []);
      })
      .catch(() => {
        setDepartureOptions([]);
        setArrivalOptions([]);
      });
  }, []);

  useEffect(() => {
    promotionApi
      .publicList()
      .then((data) => {
        const items = Array.isArray(data) ? data : [];
        setPublicPromotions(items);
        setSelectedPromotion(items[0] || null);
      })
      .catch(() => setPublicPromotions([]));
  }, []);

  const updateForm = (key, value) => {
    setError("");
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "isRoundTrip" && !value) next.returnDate = "";
      return next;
    });
  };

  const swapLocations = () => {
    setError("");
    setForm((current) => ({
      ...current,
      from: current.to,
      to: current.from,
    }));
  };

  const validate = () => {
    const from = form.from.trim();
    const to = form.to.trim();

    if (!from) return "Vui lòng chọn điểm xuất phát.";
    if (!to) return "Vui lòng chọn điểm đến.";
    if (from.toLowerCase() === to.toLowerCase())
      return "Điểm xuất phát không được trùng điểm đến.";
    if (!form.departureDate || form.departureDate < today)
      return "Ngày đi không được nhỏ hơn ngày hiện tại.";
    if (
      form.isRoundTrip &&
      (!form.returnDate || form.returnDate < form.departureDate)
    ) {
      return "Ngày về phải lớn hơn hoặc bằng ngày đi.";
    }

    return "";
  };

  const submit = (event) => {
    event.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    const query = new URLSearchParams({
      from: form.from.trim(),
      to: form.to.trim(),
      departureDate: form.departureDate,
    });

    if (form.isRoundTrip && form.returnDate) {
      query.set("returnDate", form.returnDate);
    }

    localStorage.setItem("lastTripSearchQuery", query.toString());
    navigate(`/search-results?${query.toString()}`);
  };

  const copyPromotionCode = async (code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const input = document.createElement("input");
      input.value = code;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
  };

  const moveCarousel = (setter, total, step) => {
    if (total <= 3) return;
    setter((current) => (current + step + total) % total);
  };

  return (
    <UserLayout>
      <section className="home-hero">
        <div className="home-hero-media" aria-hidden="true" />
        <div className="home-hero-shade" />
        <div className="container home-hero-inner">
          <div className="home-hero-copy">
            <p className="home-eyebrow">Nền tảng đặt vé xe khách trực tuyến</p>
            <h1>VéXeAZ</h1>
            <p>
              Chọn chuyến phù hợp, giữ ghế nhanh và quản lý vé dễ dàng cho mọi
              hành trình liên tỉnh.
            </p>
          </div>

          <form
            className="featured-search modern-home-search"
            onSubmit={submit}
          >
            <div className="home-search-widget">
              {/* <LocationPicker  */}
              {/* label="Nơi xuất phát"
                value={form.from}
                onChange={(value) => updateForm("from", value)}
                options={locationOptions}
                icon="fa-circle-dot"
                accentClass="from"
                placeholder="Chọn điểm đi"
              /> */}
              <div className="home-location-group">
                <LocationPicker
                  label="Nơi xuất phát"
                  value={form.from}
                  onChange={(value) => updateForm("from", value)}
                  options={departureOptions}
                  icon="fa-circle-dot"
                  accentClass="from"
                  placeholder="Chọn điểm đi"
                />
                <button
                  type="button"
                  className="home-swap-button"
                  onClick={swapLocations}
                  aria-label="Đổi điểm đi và điểm đến"
                >
                  <i className="fa-solid fa-right-left" />
                </button>
                <LocationPicker
                  label="Nơi đến"
                  value={form.to}
                  onChange={(value) => updateForm("to", value)}
                  options={arrivalOptions}
                  icon="fa-location-dot"
                  accentClass="to"
                  placeholder="Chọn điểm đến"
                />
              </div>
              <DatePickerField
                label="Ngày đi"
                value={form.departureDate}
                min={today}
                onChange={(value) => updateForm("departureDate", value)}
                icon="fa-calendar-days"
                emptyText="Chọn ngày đi"
              />

              {/* {form.isRoundTrip ? (
                <DatePickerField
                  label="Ngày về"
                  value={form.returnDate}
                  min={form.departureDate || today}
                  onChange={(value) => updateForm("returnDate", value)}
                  icon="fa-calendar-plus"
                  emptyText="Chọn ngày về"
                />
              ) : (
                <button
                  type="button"
                  className="home-return-button"
                  onClick={() => updateForm("isRoundTrip", true)}
                >
                  <i className="fa-solid fa-plus" />
                  Thêm ngày về
                </button>
              )} */}
              {form.isRoundTrip ? (
                <div className="return-date-wrapper">
                  <DatePickerField
                    label="Ngày về"
                    value={form.returnDate}
                    min={form.departureDate || today}
                    onChange={(value) => updateForm("returnDate", value)}
                    icon="fa-calendar-plus"
                    emptyText="Chọn ngày về"
                  />
                  <button
                    type="button"
                    className="remove-return-date-btn"
                    onClick={() => {
                      updateForm("returnDate", null);
                      updateForm("isRoundTrip", false);
                    }}
                    title="Bỏ ngày về"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="home-return-button"
                  onClick={() => updateForm("isRoundTrip", true)}
                >
                  <i className="fa-solid fa-plus" />
                  Thêm ngày về
                </button>
              )}

              <button type="submit" className="home-search-button">
                Tìm kiếm
              </button>
            </div>

            {error && <p className="search-error">{error}</p>}
          </form>
        </div>
      </section>

      <section className="container home-section">
        <div className="home-section-row">
          <div className="home-section-head">
            <span>Tuyến phổ biến</span>
            <h2>Những hành trình được chọn nhiều</h2>
          </div>
          <div className="home-carousel-actions">
            <button
              type="button"
              onClick={() =>
                moveCarousel(setRouteIndex, popularRoutes.length, -1)
              }
              aria-label="Xem hành trình trước"
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button
              type="button"
              onClick={() =>
                moveCarousel(setRouteIndex, popularRoutes.length, 1)
              }
              aria-label="Xem hành trình tiếp theo"
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
        <div className="home-route-grid">
          {visibleRoutes.map((item) => (
            <article className="home-route-card" key={item.route}>
              <img src={item.image} alt={item.route} />
              <div>
                <h3>{item.route}</h3>
                <p>{item.price}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="offers" className="container home-section">
        <div className="home-section-row">
          <div className="home-section-head">
            <span>Ưu đãi</span>
            <h2>Tiết kiệm hơn cho mỗi chuyến đi</h2>
          </div>
          {publicPromotions.length > 3 && (
            <div className="home-carousel-actions">
              <button
                type="button"
                onClick={() =>
                  moveCarousel(setPromotionIndex, publicPromotions.length, -1)
                }
                aria-label="Xem mã trước"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>
              <button
                type="button"
                onClick={() =>
                  moveCarousel(setPromotionIndex, publicPromotions.length, 1)
                }
                aria-label="Xem mã tiếp theo"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          )}
        </div>
        {publicPromotions.length > 0 ? (
          <>
            <div className="promotion-showcase-grid">
              {visiblePromotions.map((item) => {
                const code = getPromotionValue(item, ["code", "Code"]);
                const selected =
                  selectedPromotion &&
                  getPromotionValue(selectedPromotion, ["code", "Code"]) ===
                    code;
                return (
                  <article
                    className={`promotion-showcase-card ${selected ? "selected" : ""}`}
                    key={code}
                  >
                    <button
                      type="button"
                      className="promotion-showcase-select"
                      onClick={() => setSelectedPromotion(item)}
                    >
                      <div className="promotion-showcase-top">
                        <i className="fa-solid fa-ticket" />
                        <span>Mã ưu đãi</span>
                      </div>
                      <h3>{getPromotionTitle(item)}</h3>
                      <div className="promotion-code-line">
                        <strong>{code}</strong>
                        <span>Bấm để xem chi tiết</span>
                      </div>
                      <ul>
                        {getPromotionRules(item).map((rule) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ul>
                    </button>
                    <button
                      type="button"
                      className="promotion-copy-button"
                      onClick={() => copyPromotionCode(code)}
                    >
                      Sao chép
                    </button>
                  </article>
                );
              })}
            </div>
            {selectedPromotion && (
              <div className="promotion-detail-panel">
                <span>Chi tiết mã</span>
                <h3>
                  {getPromotionValue(selectedPromotion, ["code", "Code"])}
                </h3>
                <p>{getPromotionDescription(selectedPromotion)}</p>
                <ul>
                  {getPromotionRules(selectedPromotion).map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="offer-grid">
            {offerItems.map((item) => (
              <article className="offer-card" key={item.title}>
                <i className={`fa-solid ${item.icon}`} />
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="booking-guide" className="home-reasons">
        <div className="container home-section">
          <div className="home-section-head">
            <span>Lý do nên chọn</span>
            <h2>Đặt vé rõ ràng, nhanh và an tâm</h2>
          </div>
          <div className="reason-grid">
            {reasons.map(([icon, title, desc]) => (
              <article className="reason-card" key={title}>
                <i className={`fa-solid ${icon}`} />
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </UserLayout>
  );
}

const app = document.getElementById("app");
const toast = document.getElementById("toast");

const API = "http://localhost:5000/api";

// Temporary current user until the teammate's login/signup is connected.
// User ID 1 is Rahul Sharma in the PostgreSQL database.
let currentUser = {
  id: 1,
  name: "Rahul Sharma",
  email: "rahul@gmail.com",
  phone: "9876543210",
};

let db = {
  currentUser,
  users: [],
  vehicles: [],
  lots: [],
  slots: [],
  bookings: [],
  history: [],
};

let mode = localStorage.getItem("parkEaseMode") || "user";
let page = "dashboard";

async function api(url, options = {}) {
  const response = await fetch(`${API}${url}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}

async function loadData() {
  try {
    const [users, vehicles, lots, slots, bookings, history] = await Promise.all(
      [
        api("/users"),
        api(`/vehicles?user_id=${db.currentUser.id}`),
        api("/lots"),
        api("/slots"),
        api("/bookings"),
        api("/history"),
      ],
    );

    db.users = users.map((u) => ({
      id: u.user_id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      address: u.address,
    }));

    const loggedInUser = db.users.find((u) => u.id === db.currentUser.id);
    if (loggedInUser) {
      db.currentUser = loggedInUser;
      currentUser = loggedInUser;
    }

    db.vehicles = vehicles.map((v) => ({
      id: v.vehicle_id,
      userId: v.user_id,
      number: v.vehicle_number,
      type: v.vehicle_type,
    }));

    db.lots = lots.map((l) => ({
      id: l.lot_id,
      name: l.lot_name,
      location: l.location,
      total: l.total_slots,
    }));

    db.slots = slots.map((s) => ({
      id: s.slot_id,
      lotId: s.lot_id,
      number: s.slot_number,
      type: s.slot_type,
      status: s.status,
      rate: Number(s.rate_per_hour || 0),
    }));

    db.bookings = bookings.map((b) => ({
      id: b.booking_id,
      userId: b.user_id,
      vehicleId: b.vehicle_id,
      slotId: b.slot_id,
      date: b.booking_date,
      start: b.start_time,
      end: b.end_time,
      status: b.booking_status,
      userName: b.user_name,
      vehicleNumber: b.vehicle_number,
      slotNumber: b.slot_number,
      lotName: b.lot_name,
      location: b.location,
    }));

    db.history = history.map((h) => ({
      userId: h.user_id,
      userName: h.user_name,
      vehicleId: h.vehicle_id,
      vehicleNumber: h.vehicle_number,
      slotId: h.slot_id,
      slotNumber: h.slot_number,
      entry: h.entry_time,
      exit: h.exit_time,
      minutes: h.duration_minutes,
      amount: h.amount,
      payment: h.payment_status,
      paymentMethod: h.payment_method,
      lotName: h.lot_name,
    }));

    layout();
  } catch (error) {
    console.error("API error:", error);
    toastMsg(`Backend error: ${error.message}`);
  }
}

function user(id) {
  return db.users.find((x) => x.id === id);
}

function vehicle(id) {
  return db.vehicles.find((x) => x.id === id);
}

function slot(id) {
  return db.slots.find((x) => x.id === id);
}

function lot(id) {
  return db.lots.find((x) => x.id === id);
}

function money(n) {
  return "₹" + Number(n || 0).toFixed(2);
}

function fmtDate(d) {
  if (!d) return "-";

  const date = new Date(d);

  if (isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toastMsg(m) {
  if (!toast) return;
  toast.textContent = m;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function statusBadge(s) {
  return `<span class="badge ${String(s).toLowerCase()}">${s}</span>`;
}

function layout() {
  const userNav = [
    ["dashboard", "⌂", "Dashboard"],
    ["slots", "▦", "Parking Slots"],
    ["bookings", "▤", "My Bookings"],
    ["vehicles", "▣", "My Vehicles"],
    ["history", "◷", "Parking History"],
  ];

  const adminNav = [
    ["dashboard", "⌂", "Dashboard"],
    ["slots", "▦", "Parking Slots"],
    ["bookings", "▤", "All Bookings"],
    ["users", "♟", "Users"],
    ["vehicles", "▣", "Vehicles"],
    ["history", "◷", "Parking History"],
  ];

  const nav = mode === "admin" ? adminNav : userNav;

  app.innerHTML = `
        <div class="app">
            <aside class="sidebar">
                <div class="brand">
                    <div class="brand-logo">P</div>
                    <div>
                        <h2>ParkEase</h2>
                        <small>Smart Parking</small>
                    </div>
                </div>

                <nav class="nav">
                    ${nav
                      .map(
                        (n) => `
                        <button class="${page === n[0] ? "active" : ""}" onclick="go('${n[0]}')">
                            <b>${n[1]}</b>
                            <span>${n[2]}</span>
                        </button>
                    `,
                      )
                      .join("")}
                </nav>

                <div class="sidebar-bottom">
                    <div class="online">
                        <i class="dot"></i>
                        <strong>System Online</strong>
                    </div>
                    <small>PostgreSQL connected</small>
                </div>
            </aside>

            <main class="main">
                ${topbar()}
                <div id="content">${renderPage()}</div>
            </main>
        </div>

        <div class="modal-bg" id="modalBg"></div>
    `;
}

function topbar() {
  const name = mode === "admin" ? "Administrator" : db.currentUser.name;

  return `
        <div class="topbar">
            <div>
                <div class="eyebrow">SMART PARKING</div>
                <h1 class="title">${pageTitle()}</h1>
                <p class="subtitle">${pageSubtitle()}</p>
            </div>

            <div class="userbox">
                <button class="role-toggle" onclick="switchMode()">
                    Switch to ${mode === "user" ? "Admin" : "User"} →
                </button>
                <div class="avatar">${name[0]}</div>
                <div>
                    <b>${name}</b>
                    <div class="mini">${mode === "admin" ? "System Admin" : "Parking User"}</div>
                </div>
            </div>
        </div>
    `;
}

function pageTitle() {
  if (page === "dashboard") return "Dashboard";
  if (page === "slots") return "Parking Slots";
  if (page === "bookings")
    return mode === "admin" ? "All Bookings" : "My Bookings";
  if (page === "users") return "Users";
  if (page === "vehicles") return mode === "admin" ? "Vehicles" : "My Vehicles";
  return "Parking History";
}

function pageSubtitle() {
  if (page === "dashboard") {
    return mode === "admin"
      ? "Monitor the complete parking system."
      : `Welcome back, ${db.currentUser.name.split(" ")[0]}! Find your parking slot.`;
  }

  if (page === "slots") return "View and book available parking slots.";
  if (page === "bookings") return "Manage and monitor parking bookings.";
  if (page === "vehicles") return "Registered vehicles and their owners.";
  if (page === "users") return "Registered users in the parking system.";
  return "Complete parking sessions and payment information.";
}

function stats() {
  const total = db.slots.length;
  const available = db.slots.filter((s) => s.status === "Available").length;
  const occupied = db.slots.filter((s) => s.status === "Occupied").length;
  const reserved = db.slots.filter((s) => s.status === "Reserved").length;

  return `
        <div class="grid4">
            <div class="stat">
                <div class="label">Total Parking Slots</div>
                <div class="num">${total}</div>
                <div class="hint">Across ${db.lots.length} parking areas</div>
            </div>

            <div class="stat">
                <div class="label">Available Slots</div>
                <div class="num green">${available}</div>
                <div class="hint">Currently available</div>
            </div>

            <div class="stat">
                <div class="label">Occupied Slots</div>
                <div class="num red">${occupied}</div>
                <div class="hint">Currently occupied</div>
            </div>

            <div class="stat">
                <div class="label">Reserved Slots</div>
                <div class="num yellow">${reserved}</div>
                <div class="hint">
                    ${
                      mode === "admin"
                        ? db.bookings.length
                        : db.bookings.filter(
                            (b) => b.userId === db.currentUser.id,
                          ).length
                    }
                    bookings
                </div>
            </div>
        </div>
    `;
}

function dashboard() {
  const recent = db.bookings
    .filter((b) => {
      if (mode === "admin") {
        return b.status !== "Cancelled";
      }

      return b.userId === db.currentUser.id && b.status !== "Cancelled";
    })
    .slice()
    .sort((a, b) => b.id - a.id)
    .slice(0, 6);

  return `
        ${stats()}

        <div class="grid2">

            <div class="card">
                <div class="card-head">
                    <div>
                        <h3>Parking Areas</h3>
                        <p>Current availability</p>
                    </div>
                    <button class="btn secondary" onclick="go('slots')">
                        View Slots →
                    </button>
                </div>

                <div class="card-body">
                    ${db.lots
                      .map((l) => {
                        const ss = db.slots.filter((s) => s.lotId === l.id);
                        const av = ss.filter(
                          (s) => s.status === "Available",
                        ).length;

                        return `
                            <div class="lot-row">
                                <div>
                                    <div class="lot-name">${l.name}</div>
                                    <div class="lot-location">${l.location}</div>
                                </div>

                                <div style="text-align:right">
                                    <div class="available-text">${av} Available</div>
                                    <div class="mini">${ss.length} Total Slots</div>
                                </div>
                            </div>
                        `;
                      })
                      .join("")}
                </div>
            </div>

            <div class="card">
                <div class="card-head">
                    <div>
                        <h3>System Summary</h3>
                        <p>Database information</p>
                    </div>
                </div>

                <div class="card-body">
                    <div class="lot-row">
                        <span>Registered Users</span>
                        <b>${db.users.length}</b>
                    </div>

                    <div class="lot-row">
                        <span>Registered Vehicles</span>
                        <b>${mode === "admin" ? db.vehicles.length : db.vehicles.length}</b>
                    </div>

                    <div class="lot-row">
                        <span>Parking Lots</span>
                        <b>${db.lots.length}</b>
                    </div>

                    <div class="lot-row">
                        <span>Total Bookings</span>
                        <b>${db.bookings.length}</b>
                    </div>
                </div>
            </div>

        </div>

        <div class="section card">
            <div class="card-head">
                <div>
                    <h3>Recent Bookings</h3>
                    <p>Latest parking reservations</p>
                </div>
                <button class="btn secondary" onclick="go('bookings')">
                    View All →
                </button>
            </div>

            ${bookingTable(recent)}
        </div>
    `;
}

function renderSlots() {
  return `
        <div class="section-title">
            <div>
                <h2>Available Parking</h2>
                <p>Click an available slot to start a booking.</p>
            </div>

            <div class="filters">
                <select onchange="filterSlots(this.value)">
                    <option value="All">All Types</option>
                    <option>Car</option>
                    <option>Bike</option>
                    <option>SUV</option>
                    <option>EV</option>
                </select>
            </div>
        </div>

        <div class="slot-grid" id="slotGrid">
            ${slotCards(db.slots)}
        </div>
    `;
}

function slotCards(arr) {
  return arr
    .map((s) => {
      const l = lot(s.lotId);
      const can = s.status === "Available" && mode === "user";

      return `
            <div class="slot">
                <span class="type">${s.type}</span>
                <h3>${s.number}</h3>
                <div class="lot">${l?.name || "-"} · ${l?.location || "-"}</div>

                ${statusBadge(s.status)}

                <div class="rate">${money(s.rate)} / hour</div>

                ${
                  mode === "user"
                    ? `
                        <button class="btn ${can ? "" : "secondary"}"
                            ${can ? "" : "disabled"}
                            onclick="${can ? `openBooking(${s.id})` : ""}">
                            ${can ? "Book This Slot" : s.status}
                        </button>
                    `
                    : `<div class="mini">Slot ID: ${s.id}</div>`
                }
            </div>
        `;
    })
    .join("");
}

function filterSlots(type) {
  const arr =
    type === "All" ? db.slots : db.slots.filter((s) => s.type === type);

  document.getElementById("slotGrid").innerHTML = slotCards(arr);
}

function canCancelBooking(b) {
    if (b.status !== "Confirmed") return false;

    const bookingDate = String(b.date).split("T")[0];

    const now = new Date();

    const today =
        now.getFullYear() + "-" +
        String(now.getMonth() + 1).padStart(2, "0") + "-" +
        String(now.getDate()).padStart(2, "0");

    // Future date
    if (bookingDate > today) return true;

    // Previous date
    if (bookingDate < today) return false;

    // Today's booking — allow only if start time hasn't passed
    const startTime = b.start;

    const currentTime =
        String(now.getHours()).padStart(2, "0") + ":" +
        String(now.getMinutes()).padStart(2, "0");

    return startTime > currentTime;
}

function bookingTable(list) {
  if (!list.length) {
    return `<div class="empty">No bookings found.</div>`;
  }

  return `
        <div class="table-wrap">
            <table class="table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Vehicle</th>
                        <th>Slot</th>
                        <th>Lot</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>

                <tbody>
                    ${list
                      .map((b) => {
                        const u = user(b.userId);
                        const v = vehicle(b.vehicleId);
                        const s = slot(b.slotId);
                        const l = s ? lot(s.lotId) : null;

                        return `
                            <tr>
                                <td>#${b.id}</td>
                                <td>${u?.name || b.userName || "-"}</td>
                                <td>${v?.number || b.vehicleNumber || "-"}</td>
                                <td>${s?.number || b.slotNumber || "-"}</td>
                                <td>${l?.name || b.lotName || "-"}</td>
                                <td>${fmtDate(b.date)}</td>
                                <td>${b.start} - ${b.end}</td>
                                <td>${statusBadge(b.status)}</td>
                                <td>
                                    ${mode === "user" &&
b.userId === db.currentUser.id &&
canCancelBooking(b)
    ? `<button class="btn danger" onclick="cancelBooking(${b.id})">Cancel</button>`
    : ""}
                            </tr>
                        `;
                      })
                      .join("")}
                </tbody>
            </table>
        </div>
    `;
}

function bookings() {
  const list =
    mode === "admin"
      ? db.bookings
      : db.bookings.filter((b) => b.userId === db.currentUser.id);

  return `
        <div class="section-title">
            <div>
                <h2>${mode === "admin" ? "All Bookings" : "My Bookings"}</h2>
                <p>${
                  mode === "admin"
                    ? "See who booked which slot."
                    : "Your parking reservations."
                }</p>
            </div>
        </div>

        <div class="card">
            ${bookingTable(list)}
        </div>
    `;
}

function vehicles() {
  const list =
    mode === "admin"
      ? db.vehicles
      : db.vehicles.filter((v) => v.userId === db.currentUser.id);

  return `
        <div class="section-title">
            <div>
                <h2>${mode === "admin" ? "All Vehicles" : "My Vehicles"}</h2>
                <p>${
                  mode === "admin"
                    ? "All registered vehicles and owners."
                    : "Vehicles linked to your account."
                }</p>
            </div>

            ${
              mode === "user"
                ? `<button class="btn" onclick="openVehicleModal()">+ Add Vehicle</button>`
                : ""
            }
        </div>

        <div class="card">
            <div class="table-wrap">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Vehicle Number</th>
                            <th>Type</th>
                            ${mode === "admin" ? "<th>Owner</th>" : ""}
                        </tr>
                    </thead>

                    <tbody>
                        ${list
                          .map(
                            (v) => `
                            <tr>
                                <td>#${v.id}</td>
                                <td><b>${v.number}</b></td>
                                <td>${v.type}</td>
                                ${
                                  mode === "admin"
                                    ? `<td>${user(v.userId)?.name || "-"}</td>`
                                    : ""
                                }
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function users() {
  return `
        <div class="card">
            <div class="card-head">
                <div>
                    <h3>Registered Users</h3>
                    <p>All users in the parking system.</p>
                </div>
            </div>

            <div class="table-wrap">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Address</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${db.users
                          .map(
                            (u) => `
                            <tr>
                                <td>#${u.id}</td>
                                <td><b>${u.name}</b></td>
                                <td>${u.email}</td>
                                <td>${u.phone}</td>
                                <td>${u.address || "-"}</td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function history() {
  const h =
    mode === "admin"
      ? db.history
      : db.history.filter((x) => x.userId === db.currentUser.id);

  return `
        <div class="card">
            <div class="card-head">
                <div>
                    <h3>Parking History</h3>
                    <p>${
                      mode === "admin"
                        ? "All completed parking sessions."
                        : "Your completed parking sessions."
                    }</p>
                </div>
            </div>

            <div class="table-wrap">
                <table class="table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Vehicle</th>
                            <th>Slot</th>
                            <th>Entry</th>
                            <th>Exit</th>
                            <th>Duration</th>
                            <th>Amount</th>
                            <th>Payment</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${h
                          .map(
                            (x) => `
                            <tr>
                                <td>${user(x.userId)?.name || x.userName || "-"}</td>
                                <td>${vehicle(x.vehicleId)?.number || x.vehicleNumber || "-"}</td>
                                <td>${slot(x.slotId)?.number || x.slotNumber || "-"}</td>
                                <td>${x.entry || "-"}</td>
                                <td>${x.exit || "-"}</td>
                                <td>${x.minutes ?? "-"} min</td>
                                <td>${money(x.amount)}</td>
                                <td>${statusBadge(x.payment || "Pending")}</td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderPage() {
  if (page === "dashboard") return dashboard();
  if (page === "slots") return renderSlots();
  if (page === "bookings") return bookings();
  if (page === "vehicles") return vehicles();
  if (page === "users") return users();
  return history();
}

function go(p) {
  page = p;
  layout();
}

async function switchMode() {
  mode = mode === "user" ? "admin" : "user";
  localStorage.setItem("parkEaseMode", mode);
  page = "dashboard";

  if (mode === "admin") {
    await loadAdminData();
  } else {
    await loadData();
  }

  toastMsg(`Switched to ${mode === "admin" ? "Admin" : "User"} mode`);
}

async function loadAdminData() {
  try {
    const [users, vehicles, lots, slots, bookings, history] = await Promise.all(
      [
        api("/users"),
        api("/vehicles"),
        api("/lots"),
        api("/slots"),
        api("/bookings"),
        api("/history"),
      ],
    );

    db.users = users.map((u) => ({
      id: u.user_id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      address: u.address,
    }));

    db.vehicles = vehicles.map((v) => ({
      id: v.vehicle_id,
      userId: v.user_id,
      number: v.vehicle_number,
      type: v.vehicle_type,
    }));

    db.lots = lots.map((l) => ({
      id: l.lot_id,
      name: l.lot_name,
      location: l.location,
      total: l.total_slots,
    }));

    db.slots = slots.map((s) => ({
      id: s.slot_id,
      lotId: s.lot_id,
      number: s.slot_number,
      type: s.slot_type,
      status: s.status,
      rate: Number(s.rate_per_hour || 0),
    }));

    db.bookings = bookings.map((b) => ({
      id: b.booking_id,
      userId: b.user_id,
      vehicleId: b.vehicle_id,
      slotId: b.slot_id,
      date: b.booking_date,
      start: b.start_time,
      end: b.end_time,
      status: b.booking_status,
      userName: b.user_name,
      vehicleNumber: b.vehicle_number,
      slotNumber: b.slot_number,
      lotName: b.lot_name,
    }));

    db.history = history.map((h) => ({
      userId: h.user_id,
      userName: h.user_name,
      vehicleId: h.vehicle_id,
      vehicleNumber: h.vehicle_number,
      slotId: h.slot_id,
      slotNumber: h.slot_number,
      entry: h.entry_time,
      exit: h.exit_time,
      minutes: h.duration_minutes,
      amount: h.amount,
      payment: h.payment_status,
      paymentMethod: h.payment_method,
    }));

    layout();
  } catch (error) {
    console.error(error);
    toastMsg(`Backend error: ${error.message}`);
  }
}

function openBooking(slotId) {
  const s = slot(slotId);

  if (!s || s.status !== "Available") {
    toastMsg("This slot is no longer available");
    return;
  }

  const vs = db.vehicles.filter((v) => v.userId === db.currentUser.id);
  const today = new Date().toISOString().split("T")[0];

  document.getElementById("modalBg").innerHTML = `
        <div class="modal">
            <div class="modal-head">
                <div>
                    <h3>Book Parking Slot</h3>
                    <p class="mini">Reserve ${s.number}</p>
                </div>
                <button class="close" onclick="closeModal()">×</button>
            </div>

            <div class="modal-body">
                <div class="form">

                    <div class="summary">
                        <div>
                            <span>Slot</span>
                            <b>${s.number}</b>
                        </div>

                        <div>
                            <span>Type</span>
                            <b>${s.type}</b>
                        </div>

                        <div>
                            <span>Rate</span>
                            <b>${money(s.rate)} / hour</b>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Vehicle</label>
                        <select id="bookVehicle">
                            ${
                              vs.length
                                ? vs
                                    .map(
                                      (v) =>
                                        `<option value="${v.id}">${v.number} — ${v.type}</option>`,
                                    )
                                    .join("")
                                : `<option value="">No vehicle — add one first</option>`
                            }
                        </select>
                    </div>

                    <div class="form-grid">
                        <div class="form-group">
                            <label>Date</label>
                            <input id="bookDate" type="date" value="${today}" min="${today}">
                        </div>

                        <div class="form-group">
                            <label>Start Time</label>
                            <input id="bookStart" type="time" value="10:00">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>End Time</label>
                        <input id="bookEnd" type="time" value="13:00">
                    </div>

                    <button class="btn" onclick="confirmBooking(${s.id})">
                        Confirm Booking
                    </button>

                </div>
            </div>
        </div>
    `;

  document.getElementById("modalBg").classList.add("show");
}

function closeModal() {
  document.getElementById("modalBg")?.classList.remove("show");
}

async function confirmBooking(slotId) {
  const vid = Number(document.getElementById("bookVehicle").value);
  const date = document.getElementById("bookDate").value;
  const start = document.getElementById("bookStart").value;
  const end = document.getElementById("bookEnd").value;

  if (!vid || !date || !start || !end) {
    toastMsg("Please fill all booking details");
    return;
  }

  if (end <= start) {
    toastMsg("End time must be after start time");
    return;
  }

  try {
    const result = await api("/bookings", {
      method: "POST",
      body: JSON.stringify({
        user_id: db.currentUser.id,
        vehicle_id: vid,
        slot_id: slotId,
        booking_date: date,
        start_time: start,
        end_time: end,
      }),
    });

    closeModal();

    await loadData();

    page = "bookings";
    layout();

    toastMsg(`Booking #${result.booking.booking_id} confirmed`);
  } catch (error) {
    console.error(error);
    toastMsg(error.message);
  }
}

async function cancelBooking(id) {
  if (!confirm(`Cancel booking #${id}?`)) return;

  try {
    await api(`/bookings/${id}/cancel`, {
      method: "PUT",
    });

    await loadData();

    toastMsg("Booking cancelled and slot is available again");
  } catch (error) {
    console.error(error);
    toastMsg(error.message);
  }
}

function openVehicleModal() {
  document.getElementById("modalBg").innerHTML = `
        <div class="modal">
            <div class="modal-head">
                <div>
                    <h3>Add Vehicle</h3>
                    <p class="mini">Register a vehicle for booking.</p>
                </div>
                <button class="close" onclick="closeModal()">×</button>
            </div>

            <div class="modal-body">
                <div class="form">

                    <div class="form-group">
                        <label>Vehicle Number</label>
                        <input id="vehicleNo" placeholder="MH01AB1234">
                    </div>

                    <div class="form-group">
                        <label>Vehicle Type</label>
                        <select id="vehicleType">
                            <option>Car</option>
                            <option>Bike</option>
                            <option>SUV</option>
                            <option>EV</option>
                        </select>
                    </div>

                    <button class="btn" onclick="addVehicle()">
                        Add Vehicle
                    </button>

                </div>
            </div>
        </div>
    `;

  document.getElementById("modalBg").classList.add("show");
}

async function addVehicle() {
  const number = document
    .getElementById("vehicleNo")
    .value.trim()
    .toUpperCase();

  const type = document.getElementById("vehicleType").value;

  if (!number) {
    toastMsg("Enter vehicle number");
    return;
  }

  try {
    await api("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        user_id: db.currentUser.id,
        vehicle_number: number,
        vehicle_type: type,
      }),
    });

    closeModal();

    await loadData();

    page = "vehicles";
    layout();

    toastMsg("Vehicle added successfully");
  } catch (error) {
    console.error(error);
    toastMsg(error.message);
  }
}

// Load real PostgreSQL data when the page opens.
if (mode === "admin") {
  loadAdminData();
} else {
  loadData();
}

# HomeLand Dashboard UI — HTML CSS JS Prototype

## 1. File Structure

```txt
homeland-dashboard/
  index.html
  style.css
  app.js
```

---

## 2. index.html

```html
<!DOCTYPE html>
<html lang="vi" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HomeLand Premium Dashboard</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="app-shell">
    <!-- DESKTOP SIDEBAR -->
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">⌂</div>
        <div>
          <div class="brand-name">HomeLand</div>
          <div class="brand-sub">Premium CRM</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <a class="nav-item active">Dashboard</a>

        <div class="nav-group">OPERATIONS</div>
        <a class="nav-item">Tòa nhà</a>
        <a class="nav-item">Phòng</a>
        <a class="nav-item">Khách thuê</a>

        <div class="nav-group">CONTRACTS</div>
        <a class="nav-item">Hợp đồng</a>
        <a class="nav-item">Đặt cọc</a>
        <a class="nav-item">Hóa đơn</a>

        <div class="nav-group">FINANCE</div>
        <a class="nav-item">Tài chính & Báo cáo</a>

        <div class="nav-group">SALES</div>
        <a class="nav-item">Sales CRM</a>
      </nav>

      <div class="sidebar-footer">
        <a class="nav-item setting">Cài đặt</a>
        <div class="user-box">
          <div class="avatar">V</div>
          <div>
            <div class="user-name">Văn Thể Phan</div>
            <div class="user-role">Admin</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- MAIN -->
    <main class="main">
      <!-- HEADER -->
      <header class="header">
        <div class="header-left">
          <button class="icon-btn" id="sidebarToggle">☰</button>
          <div class="desktop-title">
            <h1>Dashboard</h1>
            <p>Tổng quan hoạt động hôm nay</p>
          </div>

          <div class="mobile-title">
            <span class="logo-green">HomeLand</span>
            <span class="logo-dark">Premium</span>
          </div>
        </div>

        <div class="search-box">
          <span>⌕</span>
          <input placeholder="Tìm phòng, khách thuê, hợp đồng, hóa đơn..." />
        </div>

        <div class="header-actions">
          <button class="icon-btn" id="themeToggle">☾</button>
          <button class="icon-btn notify">🔔<span>8</span></button>
        </div>
      </header>

      <!-- CONTENT -->
      <section class="content">
        <section class="top-grid">
          <div class="hero-card">
            <div>
              <p>Chào mừng trở lại, Văn Thể Phan 👋</p>
              <h2>Hôm nay có 8 việc cần xử lý</h2>
              <ul>
                <li>42.500.000 đ công nợ</li>
                <li>3 hợp đồng sắp hết hạn</li>
                <li>2 phòng cần dọn</li>
              </ul>
              <button>Xem chi tiết công việc →</button>
            </div>
            <div class="hero-building">▣</div>
          </div>

          <div class="alert-cards">
            <div class="alert-card red">
              <b>8</b>
              <span>Hóa đơn quá hạn</span>
              <small>42.500.000 đ</small>
            </div>
            <div class="alert-card orange">
              <b>3</b>
              <span>Hợp đồng sắp hết hạn</span>
              <small>Trong 7 ngày</small>
            </div>
            <div class="alert-card yellow">
              <b>2</b>
              <span>Phòng cần dọn</span>
              <small>Check-out hôm nay</small>
            </div>
            <div class="alert-card purple">
              <b>1</b>
              <span>Cọc chờ xử lý</span>
              <small>Trong 2 ngày</small>
            </div>
          </div>
        </section>

        <section class="ai-card">
          <div class="section-title">✦ AI HomeLand Insights</div>
          <div class="ai-list">
            <div>📈 Công nợ tăng <b class="danger">18%</b></div>
            <div>⚠ LK08.25 tỷ lệ lấp đầy giảm</div>
            <div>👤 3 khách có nguy cơ nợ xấu</div>
            <div>↘ Doanh thu dự báo giảm</div>
          </div>
        </section>

        <section class="kpi-grid">
          <div class="kpi-card">
            <span>Doanh thu tháng này</span>
            <h3>285.000.000 đ</h3>
            <small class="up">↑ 12.5% so với tháng trước</small>
          </div>
          <div class="kpi-card">
            <span>Công nợ phải thu</span>
            <h3>67.000.000 đ</h3>
            <small class="danger">↑ 18.2% so với tháng trước</small>
          </div>
          <div class="kpi-card">
            <span>Tỷ lệ lấp đầy</span>
            <h3>87%</h3>
            <small class="up">↑ 7.5% so với tháng trước</small>
          </div>
          <div class="kpi-card">
            <span>Lợi nhuận ước tính</span>
            <h3>176.000.000 đ</h3>
            <small class="up">↑ 10.4% so với tháng trước</small>
          </div>
        </section>

        <section class="dashboard-grid">
          <div class="panel">
            <div class="panel-head">
              <h3>Tình hình từng tòa nhà</h3>
              <a>Xem tất cả</a>
            </div>

            <div class="building-row">
              <div class="thumb"></div>
              <div>
                <b>LK01.31</b>
                <small>9 phòng</small>
              </div>
              <div class="progress"><i style="width:89%"></i></div>
              <b>89%</b>
              <small class="danger">1 hóa đơn quá hạn</small>
            </div>

            <div class="building-row">
              <div class="thumb"></div>
              <div>
                <b>LK01.32</b>
                <small>8 phòng</small>
              </div>
              <div class="progress"><i style="width:87%"></i></div>
              <b>87%</b>
              <small class="warning">1 HĐ sắp hết hạn</small>
            </div>

            <div class="building-row">
              <div class="thumb"></div>
              <div>
                <b>LK08.24</b>
                <small>10 phòng</small>
              </div>
              <div class="progress"><i style="width:100%"></i></div>
              <b>100%</b>
              <small class="up">Ổn định</small>
            </div>

            <div class="building-row">
              <div class="thumb"></div>
              <div>
                <b>LK08.25</b>
                <small>10 phòng</small>
              </div>
              <div class="progress"><i style="width:80%"></i></div>
              <b>80%</b>
              <small class="danger">2 vấn đề</small>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h3>Việc của tôi hôm nay</h3>
              <a>Xem tất cả</a>
            </div>

            <div class="task"><input type="checkbox" /> Gọi khách Nguyễn Văn A <span>09:00</span></div>
            <div class="task"><input type="checkbox" /> Xử lý hóa đơn INV-000201 <span>10:30</span></div>
            <div class="task"><input type="checkbox" /> Kiểm tra phòng 301 <span>11:00</span></div>
            <div class="task"><input type="checkbox" /> Duyệt hợp đồng HD-2024-015 <span>14:00</span></div>
          </div>

          <div class="panel chart-panel">
            <div class="panel-head">
              <h3>Doanh thu 6 tháng gần nhất</h3>
              <a>6 tháng</a>
            </div>
            <div class="bar-chart">
              <i style="height:45%"></i>
              <i style="height:60%"></i>
              <i style="height:75%"></i>
              <i style="height:55%"></i>
              <i style="height:70%"></i>
              <i style="height:85%"></i>
            </div>
          </div>

          <div class="panel activity">
            <div class="panel-head">
              <h3>Hoạt động gần đây</h3>
              <a>Xem tất cả</a>
            </div>
            <p>09:30 Manager xác nhận thanh toán <b>+9.500.000 đ</b></p>
            <p>09:05 Sales tạo cọc phòng LK08.24</p>
            <p>08:40 Admin cập nhật hợp đồng HD-000121</p>
            <p>08:10 Hệ thống gửi Zalo nhắc nợ</p>
          </div>

          <div class="panel mobile-only">
            <div class="panel-head">
              <h3>Tình trạng phòng</h3>
              <a>Xem chi tiết</a>
            </div>
            <div class="room-status">
              <b>40</b>
              <span>Tổng phòng</span>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h3>Dự báo 30 ngày tới</h3>
              <a>Xem chi tiết</a>
            </div>
            <div class="forecast">LK01.31 <div class="progress"><i style="width:95%"></i></div>95%</div>
            <div class="forecast">LK01.32 <div class="progress"><i style="width:88%"></i></div>88%</div>
            <div class="forecast">LK08.24 <div class="progress"><i style="width:100%"></i></div>100%</div>
            <div class="forecast">LK08.25 <div class="progress"><i style="width:70%"></i></div>70%</div>
          </div>
        </section>
      </section>

      <!-- FLOATING ACTION -->
      <button class="fab" id="fabBtn">+</button>

      <div class="fab-menu" id="fabMenu">
        <button>Tạo khách thuê</button>
        <button>Tạo cọc</button>
        <button>Tạo hợp đồng</button>
        <button>Tạo hóa đơn</button>
        <button>Thanh toán</button>
      </div>

      <!-- MOBILE BOTTOM NAV -->
      <nav class="bottom-nav">
        <a class="active">⌂<span>Dashboard</span></a>
        <a>▥<span>Properties</span></a>
        <a>◉<span>Finances</span></a>
        <a>☑<span>Task</span></a>
        <a>▦<span>More</span></a>
      </nav>
    </main>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

---

## 3. style.css

```css
:root {
  --bg: #f8fafc;
  --card: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e5e7eb;
  --blue: #4f46e5;
  --green: #22c55e;
  --lime: #84cc16;
  --red: #ef4444;
  --orange: #f97316;
  --purple: #7c3aed;
  --shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

html[data-theme="dark"] {
  --bg: #0f172a;
  --card: #111827;
  --text: #f8fafc;
  --muted: #94a3b8;
  --border: #1f2937;
  --shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text);
}

.app-shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 260px;
  background: var(--card);
  border-right: 1px solid var(--border);
  padding: 24px 18px;
  display: flex;
  flex-direction: column;
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 20;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
}

.brand-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f46e5, #8b5cf6);
  color: white;
  display: grid;
  place-items: center;
  font-size: 24px;
}

.brand-name {
  font-size: 20px;
  font-weight: 800;
}

.brand-sub {
  color: var(--muted);
  font-size: 13px;
}

.sidebar-nav {
  flex: 1;
}

.nav-group {
  margin: 24px 10px 10px;
  font-size: 11px;
  color: var(--muted);
  font-weight: 700;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  border-radius: 14px;
  color: var(--text);
  text-decoration: none;
  font-weight: 600;
  margin-bottom: 4px;
  cursor: pointer;
}

.nav-item.active {
  background: rgba(79, 70, 229, 0.1);
  color: var(--blue);
}

.sidebar-footer {
  border-top: 1px solid var(--border);
  padding-top: 14px;
}

.user-box {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--lime), var(--green));
  color: white;
  display: grid;
  place-items: center;
  font-weight: 800;
}

.user-name {
  font-weight: 700;
}

.user-role {
  color: var(--muted);
  font-size: 13px;
}

.main {
  margin-left: 260px;
  width: calc(100% - 260px);
  min-height: 100vh;
}

.header {
  height: 76px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 28px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 260px;
}

.header h1 {
  margin: 0;
  font-size: 22px;
}

.header p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.mobile-title {
  display: none;
  font-size: 22px;
  font-weight: 900;
}

.logo-green {
  color: var(--green);
}

.logo-dark {
  color: var(--text);
}

.search-box {
  flex: 1;
  max-width: 560px;
  height: 44px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
}

.search-box input {
  border: 0;
  outline: none;
  background: transparent;
  width: 100%;
  color: var(--text);
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 12px;
}

.icon-btn {
  width: 42px;
  height: 42px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: 50%;
  cursor: pointer;
  position: relative;
  font-size: 18px;
}

.notify span {
  position: absolute;
  top: -5px;
  right: -4px;
  background: var(--red);
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 999px;
}

.content {
  padding: 24px;
  padding-bottom: 120px;
}

.top-grid {
  display: grid;
  grid-template-columns: 1.1fr 1.7fr;
  gap: 18px;
}

.hero-card {
  background: linear-gradient(135deg, #4f46e5, #8b5cf6);
  color: white;
  border-radius: 24px;
  padding: 28px;
  min-height: 230px;
  display: flex;
  justify-content: space-between;
  overflow: hidden;
  box-shadow: var(--shadow);
}

.hero-card h2 {
  font-size: 30px;
  line-height: 1.15;
  margin: 10px 0;
}

.hero-card ul {
  padding: 0;
  list-style: none;
  line-height: 1.9;
}

.hero-card button {
  border: 0;
  background: white;
  color: var(--blue);
  padding: 14px 20px;
  border-radius: 14px;
  font-weight: 800;
}

.hero-building {
  font-size: 110px;
  opacity: 0.35;
  align-self: center;
}

.alert-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.alert-card,
.kpi-card,
.panel,
.ai-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: var(--shadow);
}

.alert-card {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-card b {
  font-size: 28px;
}

.alert-card small,
.kpi-card small,
.panel small {
  color: var(--muted);
}

.red b,
.danger {
  color: var(--red);
}

.orange b,
.warning {
  color: var(--orange);
}

.yellow b {
  color: #eab308;
}

.purple b {
  color: var(--purple);
}

.ai-card {
  margin-top: 18px;
  padding: 18px;
}

.section-title {
  font-weight: 800;
  margin-bottom: 14px;
}

.ai-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.ai-list div {
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 14px;
  border-radius: 16px;
  font-weight: 600;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  margin-top: 18px;
}

.kpi-card {
  padding: 22px;
}

.kpi-card h3 {
  margin: 8px 0;
  font-size: 26px;
}

.up {
  color: var(--green) !important;
}

.dashboard-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1.2fr 1fr 1.2fr;
  gap: 18px;
}

.panel {
  padding: 20px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel h3 {
  margin: 0;
}

.panel a {
  color: var(--blue);
  font-size: 14px;
  font-weight: 700;
}

.building-row,
.forecast {
  display: grid;
  grid-template-columns: 48px 90px 1fr 50px 110px;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.thumb {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #cbd5e1, #64748b);
}

.progress {
  height: 8px;
  background: var(--bg);
  border-radius: 999px;
  overflow: hidden;
}

.progress i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--green), var(--lime));
  border-radius: 999px;
}

.task {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.task span {
  margin-left: auto;
  color: var(--green);
  background: rgba(34, 197, 94, 0.12);
  padding: 4px 8px;
  border-radius: 8px;
}

.bar-chart {
  height: 220px;
  display: flex;
  align-items: flex-end;
  gap: 22px;
  padding: 20px 12px 0;
}

.bar-chart i {
  flex: 1;
  background: linear-gradient(180deg, #60a5fa, #2563eb);
  border-radius: 10px 10px 0 0;
}

.activity p {
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
  color: var(--muted);
}

.activity b {
  float: right;
  color: var(--green);
}

.room-status {
  height: 160px;
  border-radius: 50%;
  border: 28px solid #3b82f6;
  width: 160px;
  display: grid;
  place-items: center;
  margin: 0 auto;
  text-align: center;
}

.room-status b {
  font-size: 34px;
}

.fab {
  position: fixed;
  right: 32px;
  bottom: 32px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 0;
  background: linear-gradient(135deg, var(--blue), #8b5cf6);
  color: white;
  font-size: 36px;
  box-shadow: 0 20px 40px rgba(79, 70, 229, 0.35);
  cursor: pointer;
  z-index: 30;
}

.fab-menu {
  position: fixed;
  right: 32px;
  bottom: 108px;
  display: none;
  flex-direction: column;
  gap: 10px;
  z-index: 30;
}

.fab-menu.show {
  display: flex;
}

.fab-menu button {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  padding: 12px 18px;
  border-radius: 14px;
  box-shadow: var(--shadow);
}

.bottom-nav {
  display: none;
}

.mobile-only {
  display: none;
}

/* TABLET */
@media (max-width: 1180px) {
  .top-grid,
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .alert-cards,
  .ai-list,
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* MOBILE */
@media (max-width: 768px) {
  body {
    background: var(--bg);
  }

  .sidebar {
    display: none;
  }

  .main {
    margin-left: 0;
    width: 100%;
  }

  .header {
    height: auto;
    padding: 18px 18px 10px;
    align-items: flex-start;
    border-bottom: 0;
    background: var(--bg);
  }

  #sidebarToggle,
  .desktop-title,
  .search-box {
    display: none;
  }

  .mobile-title {
    display: block;
  }

  .header-left {
    min-width: unset;
  }

  .header-actions {
    margin-left: auto;
  }

  .content {
    padding: 10px 16px 110px;
  }

  .top-grid {
    display: block;
  }

  .hero-card {
    min-height: 300px;
    padding: 24px;
    border-radius: 24px;
  }

  .hero-card h2 {
    font-size: 28px;
  }

  .hero-building {
    font-size: 90px;
  }

  .alert-cards {
    display: none;
  }

  .ai-list {
    grid-template-columns: 1fr;
  }

  .ai-list div:nth-child(n+4) {
    display: none;
  }

  .kpi-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .kpi-card {
    padding: 18px;
  }

  .kpi-card h3 {
    font-size: 19px;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .chart-panel,
  .activity {
    display: none;
  }

  .building-row {
    grid-template-columns: 48px 80px 1fr 42px;
  }

  .building-row small:last-child {
    grid-column: 2 / -1;
  }

  .forecast {
    grid-template-columns: 80px 1fr 40px;
  }

  .mobile-only {
    display: block;
  }

  .fab {
    width: 58px;
    height: 58px;
    right: 22px;
    bottom: 92px;
  }

  .fab-menu {
    right: 22px;
    bottom: 160px;
  }

  .bottom-nav {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    height: 72px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 26px;
    box-shadow: var(--shadow);
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    z-index: 25;
  }

  .bottom-nav a {
    display: grid;
    place-items: center;
    gap: 3px;
    color: var(--muted);
    font-size: 20px;
    text-decoration: none;
    padding-top: 10px;
  }

  .bottom-nav span {
    font-size: 11px;
    font-weight: 700;
  }

  .bottom-nav a.active {
    color: var(--blue);
  }
}
```

---

## 4. app.js

```js
const html = document.documentElement;
const themeToggle = document.getElementById("themeToggle");
const fabBtn = document.getElementById("fabBtn");
const fabMenu = document.getElementById("fabMenu");
const sidebarToggle = document.getElementById("sidebarToggle");

const savedTheme = localStorage.getItem("homeland-theme");
if (savedTheme) {
  html.setAttribute("data-theme", savedTheme);
  themeToggle.textContent = savedTheme === "dark" ? "☀" : "☾";
}

themeToggle.addEventListener("click", () => {
  const current = html.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";

  html.setAttribute("data-theme", next);
  localStorage.setItem("homeland-theme", next);

  themeToggle.textContent = next === "dark" ? "☀" : "☾";
});

fabBtn.addEventListener("click", () => {
  fabMenu.classList.toggle("show");
});

document.addEventListener("click", (event) => {
  if (!fabBtn.contains(event.target) && !fabMenu.contains(event.target)) {
    fabMenu.classList.remove("show");
  }
});

sidebarToggle.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-collapsed");
});
```

---

## 5. Ghi chú triển khai React / Next.js

Khi chuyển sang Next.js:

```txt
index.html  → app/dashboard/page.tsx
style.css   → app/globals.css hoặc Tailwind component
app.js      → useState + localStorage hook
```

Component nên tách:

```txt
AppShell
Sidebar
Header
HeroCard
AIInsights
KPICard
BuildingHealth
TaskList
ActivityFeed
MobileBottomNav
FloatingActionButton
```

Dashboard này dùng chung logic cho:

```txt
Desktop
Tablet
Mobile Web-App
```

Desktop hiển thị đầy đủ.

Mobile chỉ hiển thị phần cần xem nhanh.

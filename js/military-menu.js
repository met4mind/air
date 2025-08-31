// اسکریپت اعمال استایل نظامی به منوها
class MilitaryMenu {
  constructor() {
    this.init();
  }

  init() {
    this.applyMilitaryStyle();
    this.addMilitaryElements();
  }

  applyMilitaryStyle() {
    // اضافه کردن کلاس نظامی به منوها
    const menus = document.querySelectorAll(".menu-container");
    menus.forEach((menu) => {
      menu.classList.add("military-theme");
    });

    // اضافه کردن افکت رادار به تایمر
    const timer = document.getElementById("reset-timer");
    if (timer) {
      timer.style.position = "relative";
      timer.style.overflow = "hidden";

      const radarEffect = document.createElement("div");
      radarEffect.style.position = "absolute";
      radarEffect.style.top = "0";
      radarEffect.style.left = "0";
      radarEffect.style.width = "100%";
      radarEffect.style.height = "100%";
      radarEffect.style.background =
        "radial-gradient(circle, rgba(0,255,0,0.2) 0%, transparent 70%)";
      radarEffect.style.opacity = "0.5";
      radarEffect.style.animation = "radar-sweep 4s infinite linear";
      radarEffect.style.pointerEvents = "none";

      timer.appendChild(radarEffect);
    }
  }

  addMilitaryElements() {
    // اضافه کردن عناصر نظامی به منوها
    this.addMilitaryDecoration("main-menu");
    this.addMilitaryDecoration("leaderboard-menu");
    this.addMilitaryDecoration("upgrade-menu");
    this.addMilitaryDecoration("shop-menu");
    this.addMilitaryDecoration("free-coins-menu");
  }

  addMilitaryDecoration(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;

    // اضافه کردن حاشیه نظامی
    const borderTop = document.createElement("div");
    borderTop.style.position = "absolute";
    borderTop.style.top = "0";
    borderTop.style.left = "0";
    borderTop.style.right = "0";
    borderTop.style.height = "2px";
    borderTop.style.background =
      "linear-gradient(90deg, transparent, var(--military-sand), transparent)";

    const borderBottom = document.createElement("div");
    borderBottom.style.position = "absolute";
    borderBottom.style.bottom = "0";
    borderBottom.style.left = "0";
    borderBottom.style.right = "0";
    borderBottom.style.height = "2px";
    borderBottom.style.background =
      "linear-gradient(90deg, transparent, var(--military-sand), transparent)";

    menu.appendChild(borderTop);
    menu.appendChild(borderBottom);

    // اضافه کردن گوشه‌های نظامی
    this.addMilitaryCorners(menu);
  }

  addMilitaryCorners(menu) {
    const size = "10px";
    const borderWidth = "2px";
    const color = "var(--military-sand)";

    // گوشه بالا چپ
    const cornerTL = document.createElement("div");
    cornerTL.style.position = "absolute";
    cornerTL.style.top = "0";
    cornerTL.style.left = "0";
    cornerTL.style.width = size;
    cornerTL.style.height = size;
    cornerTL.style.borderTop = `${borderWidth} solid ${color}`;
    cornerTL.style.borderLeft = `${borderWidth} solid ${color}`;

    // گوشه بالا راست
    const cornerTR = document.createElement("div");
    cornerTR.style.position = "absolute";
    cornerTR.style.top = "0";
    cornerTR.style.right = "0";
    cornerTR.style.width = size;
    cornerTR.style.height = size;
    cornerTR.style.borderTop = `${borderWidth} solid ${color}`;
    cornerTR.style.borderRight = `${borderWidth} solid ${color}`;

    // گوشه پایین چپ
    const cornerBL = document.createElement("div");
    cornerBL.style.position = "absolute";
    cornerBL.style.bottom = "0";
    cornerBL.style.left = "0";
    cornerBL.style.width = size;
    cornerBL.style.height = size;
    cornerBL.style.borderBottom = `${borderWidth} solid ${color}`;
    cornerBL.style.borderLeft = `${borderWidth} solid ${color}`;

    // گوشه پایین راست
    const cornerBR = document.createElement("div");
    cornerBR.style.position = "absolute";
    cornerBR.style.bottom = "0";
    cornerBR.style.right = "0";
    cornerBR.style.width = size;
    cornerBR.style.height = size;
    cornerBR.style.borderBottom = `${borderWidth} solid ${color}`;
    cornerBR.style.borderRight = `${borderWidth} solid ${color}`;

    menu.appendChild(cornerTL);
    menu.appendChild(cornerTR);
    menu.appendChild(cornerBL);
    menu.appendChild(cornerBR);
  }
}

// اجرا هنگامی که DOM بارگذاری شد
document.addEventListener("DOMContentLoaded", () => {
  window.militaryMenu = new MilitaryMenu();
});

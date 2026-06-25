(function () {
  let spendingChart;
  let consumptionChart;

  function cssColor(varName, alpha) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!raw) {
      return alpha != null ? "rgba(113,113,122," + alpha + ")" : "rgb(113,113,122)";
    }
    if (alpha != null) {
      return "rgba(" + raw.replace(/ /g, ",") + "," + alpha + ")";
    }
    return "rgb(" + raw.replace(/ /g, ",") + ")";
  }

  function destroyCharts() {
    if (spendingChart) { spendingChart.destroy(); spendingChart = null; }
    if (consumptionChart) { consumptionChart.destroy(); consumptionChart = null; }
  }

  async function renderDashboardCharts() {
    const spendingCanvas = document.getElementById("spendingChart");
    const consumptionCanvas = document.getElementById("consumptionChart");
    if (!spendingCanvas && !consumptionCanvas) return;

    if (typeof Chart === "undefined") {
      try {
        await import('/static/vendor/chart/chart.umd.js');
      } catch (e) {
        console.error("Failed to load Chart.js", e);
        return;
      }
    }
    
    destroyCharts();
    const textColor = cssColor("--color-on-surface-variant");
    const gridColor = cssColor("--color-outline-variant", 0.35);
    const primaryColor = cssColor("--color-primary", 0.82);
    const warningColor = cssColor("--color-warning", 0.82);
    const infoColor = cssColor("--color-info", 0.82);
    const successColor = cssColor("--color-success", 0.82);
    const surfaceColor = cssColor("--color-surface-high", 0.9);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const spendingDataEl = document.getElementById("spendingData");
    const consumptionDataEl = document.getElementById("consumptionData");
    if (!spendingDataEl || !consumptionDataEl || !spendingCanvas || !consumptionCanvas) return;

    const spendingDataObj = JSON.parse(spendingDataEl.textContent);
    if (spendingDataObj && spendingDataObj.values.some((value) => value > 0)) {
      spendingChart = new Chart(spendingCanvas, {
        type: "doughnut",
        data: {
          labels: spendingDataObj.labels,
          datasets: [{
            data: spendingDataObj.values,
            backgroundColor: [infoColor, warningColor, primaryColor],
            borderColor: surfaceColor,
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: prefersReducedMotion ? false : undefined,
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: textColor, boxWidth: 10, usePointStyle: true, pointStyle: "circle" },
            },
          },
        },
      });
    }

    const consumptionDataObj = JSON.parse(consumptionDataEl.textContent);
    if (consumptionDataObj && consumptionDataObj.values.some((value) => value > 0)) {
      consumptionChart = new Chart(consumptionCanvas, {
        type: "line",
        data: {
          labels: consumptionDataObj.labels,
          datasets: [{
            label: "L/100 km",
            data: consumptionDataObj.values,
            borderColor: infoColor,
            backgroundColor: successColor,
            fill: false,
            borderWidth: 2,
            tension: 0.32,
            pointRadius: 3,
            pointHoverRadius: 4,
            pointBackgroundColor: infoColor,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: prefersReducedMotion ? false : undefined,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor } },
            y: { grid: { color: gridColor }, ticks: { color: textColor } },
          },
        },
      });
    }
  }

  window.renderDashboardCharts = renderDashboardCharts;
  window.addEventListener("mototrack:themechange", renderDashboardCharts);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderDashboardCharts);
  } else {
    renderDashboardCharts();
  }
})();

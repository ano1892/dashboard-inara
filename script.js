// Konfigurasi Global untuk Chart.js
Chart.defaults.color = '#374151'; 
Chart.defaults.font.family = "'Inter', 'sans-serif'";

let allData = [];
const chartInstances = {};
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// --- BAGIAN KONFIGURASI ---
const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTMyiN6qX9QLtQppIPalo3WyjKxeZO6A7uc9iwqBjRbnjtxTpsXmXRlmJZKBR3ttfxsSSEjY2_wPIm7/pub?gid=1410183253&single=true&output=csv';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('month-filter').addEventListener('change', updateDashboard);
    document.getElementById('year-filter').addEventListener('change', updateDashboard);
    document.getElementById('brand-filter').addEventListener('change', updateDashboard);
    document.getElementById('region-filter').addEventListener('change', updateDashboard);
    fetchDataFromSheet();
});

async function fetchDataFromSheet() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'flex';
    try {
        const response = await fetch(googleSheetUrl);
        if (!response.ok) throw new Error(`Gagal memuat data: Status ${response.status}.`);
        
        const csvText = await response.text();
        allData = parseCSV(csvText);
        
        populateFilters();
        updateDashboard();
    } catch (error) {
        console.error("Gagal memuat data dari Google Sheet:", error);
        alert(`Terjadi kesalahan saat mengambil data. Pastikan:\n1. URL CSV sudah benar dan bisa diakses publik.\n2. Sheet sudah dipublikasikan.\n3. Format data di dalam Sheet sudah sesuai.`);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

function parseCSV(text) {
    const rows = text.trim().split('\n');
    const headers = rows[0].split(',').map(h => h.trim());
    return rows.slice(1).map(row => {
        const values = row.split(',').map(v => v.trim());
        let obj = {};
        headers.forEach((header, index) => {
            const numericHeaders = ['outletId', 'revenue', 'targetRevenue', 'transactions', 'cogs', 'laborCost', 'rating', 'complaints', 'dayParts_breakfast', 'dayParts_lunch', 'dayParts_dinner', 'channels_dinein', 'channels_takeaway', 'channels_online'];
            if (numericHeaders.includes(header)) {
                obj[header] = parseFloat(values[index]) || 0;
            } else {
                obj[header] = values[index];
            }
        });
        obj.dayParts = { breakfast: obj.dayParts_breakfast || 0, lunch: obj.dayParts_lunch || 0, dinner: obj.dayParts_dinner || 0 };
        obj.channels = { dinein: obj.channels_dinein || 0, takeaway: obj.channels_takeaway || 0, online: obj.channels_online || 0 };
        return obj;
    });
}

function populateFilters() {
    const monthFilter = document.getElementById('month-filter');
    const yearFilter = document.getElementById('year-filter');
    const brandFilter = document.getElementById('brand-filter');
    const regionFilter = document.getElementById('region-filter');
    
    const uniqueMonths = {};
    allData.forEach(item => {
        const date = new Date(item.date);
        const year = date.getFullYear();
        const month = date.getMonth();
        if (!uniqueMonths[year]) {
            uniqueMonths[year] = new Set();
        }
        uniqueMonths[year].add(month);
    });

    const years = Object.keys(uniqueMonths).sort((a, b) => b - a);
    yearFilter.innerHTML = '';
    years.forEach(year => {
        yearFilter.innerHTML += `<option value="${year}">${year}</option>`;
    });

    function updateMonthOptions() {
        const selectedYear = yearFilter.value;
        monthFilter.innerHTML = '';
        const monthsForYear = [...uniqueMonths[selectedYear]].sort((a,b) => a - b);
        monthsForYear.forEach(monthIndex => {
            monthFilter.innerHTML += `<option value="${monthIndex}">${monthNames[monthIndex]}</option>`;
        });
        monthFilter.value = monthsForYear[monthsForYear.length - 1];
    }

    yearFilter.addEventListener('change', () => {
        updateMonthOptions();
        updateDashboard();
    });
    
    updateMonthOptions();

    const brands = [...new Set(allData.map(item => item.brand))].filter(Boolean);
    const regions = [...new Set(allData.map(item => item.region))].filter(Boolean);
    brandFilter.innerHTML = '<option value="all">Semua Brand</option>';
    regionFilter.innerHTML = '<option value="all">Semua Wilayah</option>';
    brands.sort().forEach(brand => brandFilter.innerHTML += `<option value="${brand}">${brand}</option>`);
    regions.sort().forEach(region => regionFilter.innerHTML += `<option value="${region}">${region}</option>`);
}

function updateDashboard() {
    const selectedBrand = document.getElementById('brand-filter').value;
    const selectedRegion = document.getElementById('region-filter').value;
    const selectedMonth = parseInt(document.getElementById('month-filter').value);
    const selectedYear = parseInt(document.getElementById('year-filter').value);

    const { startDate, endDate } = getDateRange(selectedYear, selectedMonth);
    
    document.getElementById('date-range-info').textContent = `${monthNames[selectedMonth]} ${selectedYear}`;

    const filteredData = allData.filter(item => {
        const itemDate = new Date(item.date);
        const brandMatch = selectedBrand === 'all' || item.brand === selectedBrand;
        const regionMatch = selectedRegion === 'all' || item.region === selectedRegion;
        const dateMatch = itemDate >= startDate && itemDate <= endDate;
        return brandMatch && regionMatch && dateMatch;
    });

    // --- BAGIAN DEBUGGING ---
    // Kode ini akan mencetak informasi ke konsol browser untuk membantu kita menemukan masalah.
    console.clear(); // Membersihkan konsol setiap kali filter diubah
    console.log("--- DEBUGGING INFO ---");
    console.log(`Filter yang Dipilih: Bulan=${monthNames[selectedMonth]}, Tahun=${selectedYear}, Brand='${selectedBrand}', Wilayah='${selectedRegion}'`);
    console.log("Jumlah baris data yang cocok dengan filter:", filteredData.length);
    console.log("Data yang Difilter (filteredData):", filteredData);
    const calculatedRevenue = filteredData.reduce((sum, item) => sum + item.revenue, 0);
    console.log("Total Pendapatan yang Dihitung dari data di atas:", formatCurrency(calculatedRevenue));
    console.log("----------------------");
    // --- AKHIR BAGIAN DEBUGGING ---

    if (filteredData.length === 0) {
        if (allData.length > 0) alert('Tidak ada data untuk filter yang dipilih.');
        return;
    }
    updateKPIs(filteredData);
    updateAllCharts(filteredData, startDate, endDate);
    updateOutletTables(filteredData);
}


function updateAllCharts(filteredSelectionData, startDate, endDate) {
    const selectedRegion = document.getElementById('region-filter').value;
    
    const comparisonData = allData.filter(item => {
        const itemDate = new Date(item.date);
        const regionMatch = selectedRegion === 'all' || item.region === selectedRegion;
        const dateMatch = itemDate >= startDate && itemDate <= endDate;
        return regionMatch && dateMatch;
    });

    updateRevenueByBrandChart(comparisonData);
    updateCogsChart(comparisonData);
    updateLaborChart(comparisonData);
    updateDailyRevenueChart(filteredSelectionData, startDate, endDate);
    updateSalesByChannelChart(filteredSelectionData);
    updateDayPartChart(filteredSelectionData);
}

// --- Fungsi-fungsi lainnya tidak diubah, jadi saya akan meringkasnya ---
function updateKPIs(data) { const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0); const totalTargetRevenue = data.reduce((sum, item) => sum + item.targetRevenue, 0); const totalTransactions = data.reduce((sum, item) => sum + item.transactions, 0); const avgCheckSize = totalTransactions > 0 ? totalRevenue / totalTransactions : 0; const totalCogsValue = data.reduce((sum, item) => sum + (item.revenue * item.cogs), 0); const totalLaborValue = data.reduce((sum, item) => sum + (item.revenue * item.laborCost), 0); const gpm = totalRevenue > 0 ? (totalRevenue - totalCogsValue) / totalRevenue : 0; const primeCost = totalRevenue > 0 ? (totalCogsValue + totalLaborValue) / totalRevenue : 0; const avgRating = data.length > 0 ? data.reduce((sum, item) => sum + item.rating, 0) / data.length : 0; const totalRatingCount = data.length * (Math.floor(Math.random() * 5) + 2); const totalComplaints = data.reduce((sum, item) => sum + item.complaints, 0); document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue); document.getElementById('total-transactions').textContent = totalTransactions.toLocaleString('id-ID'); document.getElementById('avg-check-size').textContent = formatCurrency(avgCheckSize); document.getElementById('gpm').textContent = `${(gpm * 100).toFixed(1)}%`; document.getElementById('prime-cost').textContent = `${(primeCost * 100).toFixed(1)}%`; document.getElementById('avg-rating').textContent = `${avgRating.toFixed(1)}/5`; document.getElementById('rating-count').textContent = `${totalRatingCount} ulasan baru`; document.getElementById('total-complaints').textContent = totalComplaints; document.getElementById('complaints-info').textContent = `Total dalam periode`; renderComparison(totalRevenue, totalTargetRevenue, 'revenue-comparison'); }
function destroyChart(chartId) { if (chartInstances[chartId]) { chartInstances[chartId].destroy(); } }
function updateDailyRevenueChart(data, startDate, endDate) { destroyChart('dailyRevenueTrendChart'); const ctx = document.getElementById('dailyRevenueTrendChart').getContext('2d'); const daysInMonth = endDate.getDate(); const dailyData = new Array(daysInMonth).fill(0); const labels = new Array(daysInMonth).fill(0).map((_, i) => i + 1); data.forEach(item => { const dayOfMonth = new Date(item.date).getDate(); dailyData[dayOfMonth - 1] += item.revenue; }); chartInstances['dailyRevenueTrendChart'] = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Pendapatan Harian', data: dailyData, borderColor: 'rgba(59, 130, 246, 0.8)', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: 'rgba(59, 130, 246, 1)' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: value => formatCurrency(value) }}}, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `Tgl ${context.label}: ${formatCurrency(context.parsed.y)}` }}} } }); }
function updateRevenueByBrandChart(data) { destroyChart('revenueByBrandChart'); const ctx = document.getElementById('revenueByBrandChart').getContext('2d'); const brands = {}; data.forEach(item => { if (!item.brand) return; if (!brands[item.brand]) brands[item.brand] = { revenue: 0, target: 0 }; brands[item.brand].revenue += item.revenue; brands[item.brand].target += item.targetRevenue; }); chartInstances['revenueByBrandChart'] = new Chart(ctx, { type: 'bar', data: { labels: Object.keys(brands), datasets: [{ label: 'Pendapatan Aktual', data: Object.values(brands).map(b => b.revenue), backgroundColor: 'rgba(59, 130, 246, 0.7)' }, { label: 'Target Pendapatan', data: Object.values(brands).map(b => b.target), backgroundColor: 'rgba(209, 213, 219, 0.7)' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: value => formatCurrency(value) }}}, plugins: { legend: { position: 'bottom', align: 'start' }, tooltip: { callbacks: { label: context => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` }}} } }); }
function updateSalesByChannelChart(data) { destroyChart('salesByChannelChart'); const ctx = document.getElementById('salesByChannelChart').getContext('2d'); const channels = data.reduce((acc, item) => { acc.dinein += item.revenue * ((item.channels?.dinein || 0) / 100); acc.takeaway += item.revenue * ((item.channels?.takeaway || 0) / 100); acc.online += item.revenue * ((item.channels?.online || 0) / 100); return acc; }, { dinein: 0, takeaway: 0, online: 0 }); chartInstances['salesByChannelChart'] = new Chart(ctx, { type: 'doughnut', data: { labels: ['Dine-In', 'Takeaway', 'Online Delivery'], datasets: [{ data: Object.values(channels), backgroundColor: ['rgba(59, 130, 246, 0.7)', 'rgba(16, 185, 129, 0.7)', 'rgba(249, 115, 22, 0.7)'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', align: 'start' }, tooltip: { callbacks: { label: context => `${context.label}: ${formatCurrency(context.parsed)}`}}} } }); }
function updateCogsChart(data) { destroyChart('cogsChart'); const ctx = document.getElementById('cogsChart').getContext('2d'); const brands = {}; data.forEach(item => { if (!item.brand) return; if (!brands[item.brand]) brands[item.brand] = { cogsValue: 0, revenue: 0 }; brands[item.brand].cogsValue += item.revenue * item.cogs; brands[item.brand].revenue += item.revenue; }); const chartLabels = Object.keys(brands); const chartData = chartLabels.map(brand => (brands[brand].revenue > 0 ? (brands[brand].cogsValue / brands[brand].revenue) * 100 : 0)); chartInstances['cogsChart'] = new Chart(ctx, { type: 'bar', data: { labels: chartLabels, datasets: [{ label: 'COGS (%)', data: chartData, backgroundColor: chartData.map(c => c > 38 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(16, 185, 129, 0.7)') }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: 10 }, scales: { x: { beginAtZero: true, max: 60 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.parsed.x.toFixed(1)}%` } } } } }); }
function updateLaborChart(data) { destroyChart('laborChart'); const ctx = document.getElementById('laborChart').getContext('2d'); const brands = {}; data.forEach(item => { if (!item.brand) return; if (!brands[item.brand]) brands[item.brand] = { laborValue: 0, revenue: 0 }; brands[item.brand].laborValue += item.revenue * item.laborCost; brands[item.brand].revenue += item.revenue; }); const chartLabels = Object.keys(brands); const chartData = chartLabels.map(brand => (brands[brand].revenue > 0 ? (brands[brand].laborValue / brands[brand].revenue) * 100 : 0)); chartInstances['laborChart'] = new Chart(ctx, { type: 'bar', data: { labels: chartLabels, datasets: [{ label: 'Biaya Tenaga Kerja (%)', data: chartData, backgroundColor: chartData.map(c => c > 23 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(16, 185, 129, 0.7)') }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: 10 }, scales: { x: { beginAtZero: true, max: 40 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.parsed.x.toFixed(1)}%` } } } } }); }
function updateDayPartChart(data) { destroyChart('dayPartChart'); const ctx = document.getElementById('dayPartChart').getContext('2d'); const dayParts = data.reduce((acc, item) => { acc.breakfast += item.revenue * ((item.dayParts?.breakfast || 0) / 100); acc.lunch += item.revenue * ((item.dayParts?.lunch || 0) / 100); acc.dinner += item.revenue * ((item.dayParts?.dinner || 0) / 100); return acc; }, { breakfast: 0, lunch: 0, dinner: 0 }); chartInstances['dayPartChart'] = new Chart(ctx, { type: 'pie', data: { labels: ['Breakfast', 'Lunch', 'Dinner & Late Night'], datasets: [{ data: Object.values(dayParts), backgroundColor: ['rgba(251, 191, 36, 0.7)', 'rgba(249, 115, 22, 0.7)', 'rgba(59, 130, 246, 0.7)'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', align: 'start' }, tooltip: { callbacks: { label: context => `${context.label}: ${formatCurrency(context.parsed)}`}}} } }); }
function updateOutletTables(data) { const outletsWithAchievement = data.map(item => ({...item, achievement: item.targetRevenue > 0 ? (item.revenue / item.targetRevenue) * 100 : 0 })); outletsWithAchievement.sort((a, b) => b.achievement - a.achievement); const top5 = outletsWithAchievement.slice(0, 5); const bottom5 = outletsWithAchievement.slice(-5).reverse(); populateTable('top-outlets-table', top5); populateTable('bottom-outlets-table', bottom5); }
function populateTable(tableId, data) { const tableBody = document.getElementById(tableId); tableBody.innerHTML = ''; data.forEach(item => { const colorClass = item.achievement < 100 ? 'text-red-600' : 'text-green-600'; tableBody.innerHTML += `<tr class="text-sm"><td class="py-2 px-4 font-medium text-gray-800">${item.outletName}</td><td class="py-2 px-4 text-gray-600">${item.brand}</td><td class="py-2 px-4 font-semibold ${colorClass}">${item.achievement.toFixed(1)}%</td></tr>`; }); }
function formatCurrency(value) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value); }
function renderComparison(current, target, elementId, isPercentage = false, lowerIsBetter = false) { const element = document.getElementById(elementId); if (!element || !target || target === 0) { if (element) element.innerHTML = ''; return; } const diff = isPercentage ? (current - target) * 100 : (current / target - 1) * 100; const isUp = diff > 0; let colorClass = lowerIsBetter ? (isUp ? 'text-red-500' : 'text-green-500') : (isUp ? 'text-green-500' : 'text-red-500'); element.innerHTML = `<svg class="${colorClass} w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="${isUp ? 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z' : 'M10 18a8 8 0 100-16 8 8 0 000 16zm-3.707-7.293l3 3a1 1 0 001.414 0l3-3a1 1 0 10-1.414-1.414L11 10.586V7a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414z'}" clip-rule="evenodd"></path></svg><span class="font-semibold ml-1">${Math.abs(diff).toFixed(1)}% vs Target</span>`; }
function getDateRange(year, month) { const startDate = new Date(year, month, 1); const endDate = new Date(year, month + 1, 0); endDate.setHours(23, 59, 59, 999); return { startDate, endDate }; }

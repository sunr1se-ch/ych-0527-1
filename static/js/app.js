const API_BASE = '';

let phBarChart = null;
let phDiffScatterChart = null;
let groupLayoutChart = null;
let trendChart = null;

let currentFilters = {
    group: '',
    startDate: '',
    endDate: ''
};

const GROUP_COLORS = {
    'A组': '#667eea',
    'B组': '#f093fb',
    'C组': '#4facfe',
    'D组': '#43e97b',
    'E组': '#fa709a',
    'F组': '#fee140'
};

(function() {
    initCharts();
    loadInitialData();
    setupEventListeners();
})();

function initCharts() {
    phBarChart = echarts.init(document.getElementById('phBarChart'));
    phDiffScatterChart = echarts.init(document.getElementById('phDiffScatterChart'));
    groupLayoutChart = echarts.init(document.getElementById('groupLayoutChart'));
    trendChart = echarts.init(document.getElementById('trendChart'));

    window.addEventListener('resize', function() {
        phBarChart.resize();
        phDiffScatterChart.resize();
        groupLayoutChart.resize();
        trendChart.resize();
    });
}

function setupEventListeners() {
    document.addEventListener('click', function(e) {
        const exportMenu = document.getElementById('exportMenu');
        const exportBtn = e.target.closest('.btn-info');
        if (!exportBtn && !exportMenu.contains(e.target)) {
            exportMenu.classList.remove('active');
        }
    });
}

async function loadInitialData() {
    try {
        const [groupsRes, dateRangeRes, pondsRes] = await Promise.all([
            fetch(`${API_BASE}/api/groups`),
            fetch(`${API_BASE}/api/date-range`),
            fetch(`${API_BASE}/api/ponds`)
        ]);

        const groups = await groupsRes.json();
        const dateRange = await dateRangeRes.json();
        const ponds = await pondsRes.json();

        if (groups.success) {
            const select = document.getElementById('groupSelect');
            groups.data.forEach(g => {
                const option = document.createElement('option');
                option.value = g;
                option.textContent = g;
                select.appendChild(option);
            });
        }

        if (dateRange.success) {
            const startInput = document.getElementById('startDate');
            const endInput = document.getElementById('endDate');
            startInput.value = dateRange.data.min_date;
            endInput.value = dateRange.data.max_date;
            startInput.min = dateRange.data.min_date;
            startInput.max = dateRange.data.max_date;
            endInput.min = dateRange.data.min_date;
            endInput.max = dateRange.data.max_date;
        }

        if (ponds.success) {
            const pondSelect = document.getElementById('manualPond');
            ponds.data.forEach(p => {
                const option = document.createElement('option');
                option.value = p['池号'];
                option.textContent = `${p['池号']} (${p['所在组']})`;
                pondSelect.appendChild(option);
            });
        }

        currentFilters.startDate = dateRange.data.min_date;
        currentFilters.endDate = dateRange.data.max_date;

        loadData();
    } catch (error) {
        showToast('加载初始数据失败', 'error');
        console.error(error);
    }
}

function loadData() {
    currentFilters.group = document.getElementById('groupSelect').value;
    currentFilters.startDate = document.getElementById('startDate').value;
    currentFilters.endDate = document.getElementById('endDate').value;

    if (currentFilters.startDate && currentFilters.endDate && currentFilters.startDate > currentFilters.endDate) {
        showToast('起始日期不能大于结束日期', 'error');
        return;
    }

    Promise.all([
        fetchSummary(),
        fetchPeriodAverages(),
        fetchAdjacentPhDiff(),
        fetchDailyAverages(),
        fetchGroupLayout()
    ]);
}

async function fetchSummary() {
    try {
        const params = new URLSearchParams(currentFilters);
        const res = await fetch(`${API_BASE}/api/summary?${params}`);
        const data = await res.json();

        if (data.success) {
            document.getElementById('totalPonds').textContent = data.data.total_ponds;
            document.getElementById('totalRecords').textContent = data.data.total_records;
            document.getElementById('avgPh').textContent = data.data.avg_ph;
            document.getElementById('avgLevel').textContent = data.data.avg_level;
            document.getElementById('maxPhDiff').textContent = data.data.max_ph_diff;
            document.getElementById('avgPhDiff').textContent = data.data.avg_ph_diff;
        }
    } catch (error) {
        console.error('获取汇总数据失败:', error);
    }
}

async function fetchPeriodAverages() {
    try {
        const params = new URLSearchParams(currentFilters);
        const res = await fetch(`${API_BASE}/api/period-averages?${params}`);
        const data = await res.json();

        if (data.success) {
            renderPeriodTable(data.data);
            renderPhBarChart(data.data);
        }
    } catch (error) {
        console.error('获取期内统计失败:', error);
    }
}

async function fetchAdjacentPhDiff() {
    try {
        const params = new URLSearchParams(currentFilters);
        const res = await fetch(`${API_BASE}/api/adjacent-ph-diff?${params}`);
        const data = await res.json();

        if (data.success) {
            renderAdjacentTable(data.data);
            renderPhDiffScatterChart(data.data);
        }
    } catch (error) {
        console.error('获取邻池pH差值失败:', error);
    }
}

async function fetchDailyAverages() {
    try {
        const params = new URLSearchParams(currentFilters);
        const res = await fetch(`${API_BASE}/api/daily-averages?${params}`);
        const data = await res.json();

        if (data.success) {
            renderTrendChart(data.data);
        }
    } catch (error) {
        console.error('获取日均数据失败:', error);
    }
}

async function fetchGroupLayout() {
    try {
        const res = await fetch(`${API_BASE}/api/group-layout`);
        const data = await res.json();

        if (data.success) {
            renderGroupLayoutChart(data.data);
        }
    } catch (error) {
        console.error('获取池组布局失败:', error);
    }
}

function renderPeriodTable(data) {
    const tbody = document.querySelector('#periodTable tbody');
    tbody.innerHTML = '';

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${row['池号']}</strong></td>
            <td>${row['所在组']}</td>
            <td>${row['设计液位厘米']}</td>
            <td>${row['期内液位均值']}</td>
            <td><span style="color: ${getPhColor(row['期内pH均值'])}; font-weight: 600;">${row['期内pH均值']}</span></td>
            <td>${row['期内盐花厚度均值']}</td>
            <td>${row['记录天数']}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAdjacentTable(data) {
    const tbody = document.querySelector('#adjacentTable tbody');
    tbody.innerHTML = '';

    data.forEach(row => {
        const tr = document.createElement('tr');
        const diffClass = row['pH差值'] > 0.3 ? 'color: #e74c3c;' : row['pH差值'] > 0.15 ? 'color: #f39c12;' : 'color: #27ae60;';
        tr.innerHTML = `
            <td>${row['组号']}</td>
            <td>${row['池号1']}</td>
            <td>${row['池号2']}</td>
            <td>${row['池1_pH均值']}</td>
            <td>${row['池2_pH均值']}</td>
            <td><strong style="${diffClass}">${row['pH差值']}</strong></td>
            <td>${row['记录天数']}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPhBarChart(data) {
    const groups = {};
    data.forEach(row => {
        const group = row['所在组'];
        if (!groups[group]) groups[group] = [];
        groups[group].push({
            name: row['池号'],
            value: row['期内pH均值'],
            level: row['期内液位均值'],
            designLevel: row['设计液位厘米']
        });
    });

    const allPonds = [];
    const series = [];
    const legendData = [];

    Object.keys(groups).sort().forEach(group => {
        legendData.push(group);
        const pondData = groups[group].sort((a, b) => a.name.localeCompare(b.name));
        const values = pondData.map(p => p.value);
        const pondNames = pondData.map(p => p.name);

        pondNames.forEach(p => {
            if (!allPonds.includes(p)) allPonds.push(p);
        });

        series.push({
            name: group,
            type: 'bar',
            data: pondData.map(p => ({
                value: p.value,
                itemStyle: { color: GROUP_COLORS[group] || '#666' }
            })),
            barGap: '10%',
            label: {
                show: true,
                position: 'top',
                formatter: '{c}'
            }
        });
    });

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: function(params) {
                const p = params[0];
                return `<strong>${p.name}</strong><br/>pH均值: ${p.value}`;
            }
        },
        legend: {
            data: legendData,
            top: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: allPonds.sort(),
            axisLabel: { rotate: 45 }
        },
        yAxis: {
            type: 'value',
            name: 'pH值',
            min: 4,
            max: 8
        },
        series: series
    };

    phBarChart.setOption(option);
}

function renderPhDiffScatterChart(data) {
    const groups = {};
    data.forEach(row => {
        const group = row['组号'];
        if (!groups[group]) groups[group] = [];
        groups[group].push({
            name: `${row['池号1']}-${row['池号2']}`,
            value: [row['池1_pH均值'], row['池2_pH均值'], row['pH差值']],
            diff: row['pH差值']
        });
    });

    const series = [];
    const legendData = [];

    Object.keys(groups).forEach(group => {
        legendData.push(group);
        series.push({
            name: group,
            type: 'scatter',
            data: groups[group].map(item => ({
                value: item.value,
                symbolSize: Math.max(10, item.diff * 50),
                itemStyle: {
                    color: GROUP_COLORS[group] || '#666',
                    opacity: 0.7
                }
            })),
            label: {
                show: true,
                formatter: function(params) {
                    return params.data.value[2].toFixed(2);
                },
                position: 'top',
                fontSize: 10
            }
        });
    });

    const option = {
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                return `<strong>${params.seriesName}</strong><br/>
                        池1 pH: ${params.value[0]}<br/>
                        池2 pH: ${params.value[1]}<br/>
                        <strong>pH差值: ${params.value[2]}</strong>`;
            }
        },
        legend: {
            data: legendData,
            top: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            name: '池1 pH均值',
            min: 4,
            max: 8
        },
        yAxis: {
            type: 'value',
            name: '池2 pH均值',
            min: 4,
            max: 8
        },
        series: series
    };

    phDiffScatterChart.setOption(option);
}

function renderGroupLayoutChart(data) {
    const groups = Object.keys(data).sort();
    const maxPonds = Math.max(...groups.map(g => data[g].length));

    const series = [];
    const gridWidth = 80;
    const gridHeight = 60;
    const gapX = 20;
    const gapY = 30;
    const startX = 80;
    const startY = 60;

    groups.forEach((group, groupIdx) => {
        const ponds = data[group];
        ponds.forEach((pond, pondIdx) => {
            const x = startX + pondIdx * (gridWidth + gapX);
            const y = startY + groupIdx * (gridHeight + gapY);

            series.push({
                type: 'custom',
                renderItem: function(params, api) {
                    return {
                        type: 'rect',
                        shape: {
                            x: x,
                            y: y,
                            width: gridWidth,
                            height: gridHeight,
                            r: 8
                        },
                        style: {
                            fill: GROUP_COLORS[group] || '#666',
                            stroke: '#fff',
                            lineWidth: 2,
                            shadowBlur: 10,
                            shadowColor: 'rgba(0,0,0,0.2)'
                        }
                    };
                },
                data: [0]
            });

            series.push({
                type: 'custom',
                renderItem: function(params, api) {
                    return {
                        type: 'text',
                        style: {
                            text: pond['池号'],
                            x: x + gridWidth / 2,
                            y: y + gridHeight / 2 - 8,
                            fill: '#fff',
                            fontSize: 16,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            textVerticalAlign: 'middle'
                        }
                    };
                },
                data: [0]
            });

            series.push({
                type: 'custom',
                renderItem: function(params, api) {
                    return {
                        type: 'text',
                        style: {
                            text: `${pond['设计液位厘米']}cm`,
                            x: x + gridWidth / 2,
                            y: y + gridHeight / 2 + 12,
                            fill: 'rgba(255,255,255,0.9)',
                            fontSize: 11,
                            textAlign: 'center',
                            textVerticalAlign: 'middle'
                        }
                    };
                },
                data: [0]
            });
        });

        series.push({
            type: 'custom',
            renderItem: function(params, api) {
                return {
                    type: 'text',
                    style: {
                        text: group,
                        x: 30,
                        y: startY + groupIdx * (gridHeight + gapY) + gridHeight / 2,
                        fill: '#333',
                        fontSize: 14,
                        fontWeight: 'bold',
                        textAlign: 'right',
                        textVerticalAlign: 'middle'
                    }
                };
            },
            data: [0]
        });
    });

    const option = {
        tooltip: {
            show: false
        },
        grid: {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        },
        xAxis: {
            show: false,
            min: 0,
            max: startX + maxPonds * (gridWidth + gapX) + 50
        },
        yAxis: {
            show: false,
            min: 0,
            max: startY + groups.length * (gridHeight + gapY) + 50
        },
        series: series
    };

    groupLayoutChart.setOption(option);
}

function renderTrendChart(data) {
    if (data.length === 0) {
        trendChart.setOption({ title: { text: '暂无数据', left: 'center', top: 'center' } });
        return;
    }

    const dates = [...new Set(data.map(d => d['记录日期']))].sort();
    const ponds = [...new Set(data.map(d => d['池号']))].sort();

    const phSeries = [];
    const levelSeries = [];

    ponds.forEach(pond => {
        const pondData = data.filter(d => d['池号'] === pond).sort((a, b) => a['记录日期'].localeCompare(b['记录日期']));
        const group = pondData[0]?.['所在组'];
        const color = GROUP_COLORS[group] || '#666';

        phSeries.push({
            name: `${pond} pH`,
            type: 'line',
            yAxisIndex: 0,
            data: dates.map(date => {
                const d = pondData.find(p => p['记录日期'] === date);
                return d ? d['pH'] : null;
            }),
            smooth: true,
            lineStyle: { color: color, width: 2 },
            itemStyle: { color: color },
            symbol: 'circle',
            symbolSize: 6
        });

        levelSeries.push({
            name: `${pond} 液位`,
            type: 'line',
            yAxisIndex: 1,
            data: dates.map(date => {
                const d = pondData.find(p => p['记录日期'] === date);
                return d ? d['实测液位厘米'] : null;
            }),
            smooth: true,
            lineStyle: { color: color, width: 2, type: 'dashed' },
            itemStyle: { color: color },
            symbol: 'diamond',
            symbolSize: 6
        });
    });

    const option = {
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: [...ponds.map(p => `${p} pH`), ...ponds.map(p => `${p} 液位`)],
            top: 0,
            type: 'scroll',
            textStyle: { fontSize: 10 }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '20%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: { rotate: 45, fontSize: 10 }
        },
        yAxis: [
            {
                type: 'value',
                name: 'pH值',
                min: 4,
                max: 8,
                position: 'left'
            },
            {
                type: 'value',
                name: '液位(cm)',
                min: 80,
                max: 220,
                position: 'right'
            }
        ],
        series: [...phSeries, ...levelSeries]
    };

    trendChart.setOption(option);
}

function getPhColor(ph) {
    if (ph < 5.5) return '#e74c3c';
    if (ph < 6.0) return '#f39c12';
    if (ph < 6.5) return '#27ae60';
    return '#3498db';
}

function openImportModal() {
    document.getElementById('importModal').classList.add('active');
    document.getElementById('manualDate').value = new Date().toISOString().split('T')[0];
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
    document.getElementById('importResult').className = 'import-result';
    document.getElementById('importResult').textContent = '';
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (tab === 'csv') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('csvTab').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('manualTab').classList.add('active');
    }
}

async function importCsv() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];

    if (!file) {
        showImportResult('请选择CSV文件', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/api/import-csv`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            showImportResult(data.message, 'success');
            showToast(data.message, 'success');
            loadData();
            fileInput.value = '';
        } else {
            showImportResult(data.message, 'error');
        }
    } catch (error) {
        showImportResult('导入失败: ' + error.message, 'error');
    }
}

async function addManualRecord() {
    const record = {
        '池号': document.getElementById('manualPond').value,
        '记录日期': document.getElementById('manualDate').value,
        '实测液位厘米': parseFloat(document.getElementById('manualLevel').value),
        'pH': parseFloat(document.getElementById('manualPh').value),
        '表层盐花厚度毫米': parseFloat(document.getElementById('manualSalt').value)
    };

    if (!record['池号'] || !record['记录日期'] || isNaN(record['实测液位厘米']) || isNaN(record['pH']) || isNaN(record['表层盐花厚度毫米'])) {
        showImportResult('请填写完整的记录信息', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: [record] })
        });
        const data = await res.json();

        if (data.success) {
            showImportResult(data.message, 'success');
            showToast(data.message, 'success');
            loadData();

            document.getElementById('manualLevel').value = '';
            document.getElementById('manualPh').value = '';
            document.getElementById('manualSalt').value = '';
        } else {
            showImportResult(data.message, 'error');
        }
    } catch (error) {
        showImportResult('添加失败: ' + error.message, 'error');
    }
}

function showImportResult(message, type) {
    const resultEl = document.getElementById('importResult');
    resultEl.textContent = message;
    resultEl.className = `import-result ${type}`;
}

function showExportMenu() {
    const menu = document.getElementById('exportMenu');
    const btn = event.target.closest('.btn-info');
    const rect = btn.getBoundingClientRect();

    menu.style.top = (rect.bottom + 5) + 'px';
    menu.style.left = rect.left + 'px';
    menu.classList.toggle('active');
}

function exportData(type) {
    const params = new URLSearchParams({
        ...currentFilters,
        type: type
    });
    window.location.href = `${API_BASE}/api/export?${params}`;
    document.getElementById('exportMenu').classList.remove('active');
    showToast('导出中...', 'info');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
